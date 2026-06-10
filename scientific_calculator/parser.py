"""Recursive-descent parser for the scientific calculator.

This module turns the flat token stream produced by
:func:`scientific_calculator.tokenizer.tokenize` into an AST whose nodes
are defined in :mod:`scientific_calculator.ast_nodes`. The parser owns
precedence and associativity; the evaluator only walks the resulting
tree and computes values.

Grammar
-------
The grammar is a textbook recursive-descent infix grammar with one
twist: the Python-style unary-minus rule for ``**`` (``-2**2 == -4``).
The spec's reference grammar nests ``unary`` inside ``factor`` on the
left of ``**``, which would produce ``(-2)**2``; we instead lift unary
minus *outside* of ``**`` on the left (so it binds looser there) while
keeping it *inside* on the right (where it binds tighter). This matches
Python's grammar shape: ``factor: '-' factor | power`` ::

    expression := term (('+' | '-') term)*
    term       := factor (('*' | '/' | '//' | '%') factor)*
    factor     := '-' factor | power                     # unary minus
    power      := postfix ('**' factor | '^' factor)?    # right-assoc; right ↦ factor
    postfix    := atom ('!')*
    atom       := NUMBER
                | IDENT ( '(' arglist? ')' )?            # call or bare ident
                | '(' expression ')'
    arglist    := expression (',' expression)*

Precedence (lowest → highest):

1. ``+`` ``-``                 (left-associative, binary)
2. ``*`` ``/`` ``//`` ``%``    (left-associative)
3. Unary ``-``                 (prefix; outside ``**`` left operand)
4. ``**`` / ``^``              (right-associative)
5. Postfix ``!``               (factorial)
6. Atoms (number / identifier / parens / function call)

Because the right operand of ``**`` recurses back into ``factor``,
``2**-3`` correctly parses as ``2 ** (-3)`` — unary minus binds tighter
than ``**`` on the right. Because ``factor`` consumes the leading ``-``
*before* delegating to ``power``, ``-2**2`` parses as ``-(2**2)`` — unary
minus binds looser than ``**`` on the left.

``^`` is an alias for ``**`` (same right-associativity, same precedence).

Error reporting
---------------
Every parse failure raises :class:`scientific_calculator.errors.SyntaxErrorCalc`
with the offending token's ``position`` and ``token`` lexeme. The parser
guarantees that, after consuming the top-level ``expression``, the next
token is ``EOF``; anything else is a syntax error reporting trailing
input at the position of the unexpected token.

Safety
------
The parser operates on tokens, not raw strings, but for consistency with
the tokenizer's safety contract it never calls the builtins ``eval``,
``exec``, ``compile``, nor imports the stdlib ``tokenize`` module.
"""

from __future__ import annotations

from .ast_nodes import (
    BinaryOpNode,
    CallNode,
    IdentNode,
    Node,
    NumberNode,
    UnaryOpNode,
)
from .errors import SyntaxErrorCalc
from .tokenizer import (
    BANG,
    COMMA,
    EOF,
    IDENT,
    LPAREN,
    NUMBER,
    OP,
    RPAREN,
    Token,
)

# Operator sets per precedence level. Bare string literals match the
# token lexemes the tokenizer emits.
_ADDITIVE_OPS: frozenset[str] = frozenset({"+", "-"})
_MULTIPLICATIVE_OPS: frozenset[str] = frozenset({"*", "/", "//", "%"})
_POWER_OPS: frozenset[str] = frozenset({"**", "^"})


class _Parser:
    """Internal mutable parsing state — a token list plus a cursor.

    Kept private; callers use the module-level :func:`parse` entry
    point. The class exists purely to give the recursive helpers a
    shared cursor without threading an index through every call.
    """

    __slots__ = ("_tokens", "_pos")

    def __init__(self, tokens: list[Token]) -> None:
        self._tokens = tokens
        self._pos = 0

    # ------------------------------------------------------------------
    # Cursor helpers
    # ------------------------------------------------------------------

    def _peek(self) -> Token:
        """Return the current token without advancing."""
        return self._tokens[self._pos]

    def _advance(self) -> Token:
        """Consume the current token and return it."""
        tok = self._tokens[self._pos]
        # Don't walk past EOF — the EOF token is always the last entry.
        if tok.kind != EOF:
            self._pos += 1
        return tok

    def _match_op(self, ops: frozenset[str]) -> Token | None:
        """If the current token is an ``OP`` with a lexeme in ``ops``,
        consume and return it; otherwise return ``None``."""
        tok = self._peek()
        if tok.kind == OP and tok.value in ops:
            return self._advance()
        return None

    def _expect(self, kind: str, message: str) -> Token:
        """Consume a token of ``kind`` or raise ``SyntaxErrorCalc``."""
        tok = self._peek()
        if tok.kind != kind:
            self._error(message, tok)
        return self._advance()

    @staticmethod
    def _error(message: str, tok: Token) -> None:
        """Raise ``SyntaxErrorCalc`` at the given token's position."""
        # ``Token.value`` is a float for NUMBER tokens; coerce to str so
        # the error's ``token`` attribute is always a string lexeme.
        lexeme = "" if tok.kind == EOF else str(tok.value)
        raise SyntaxErrorCalc(
            message=message,
            position=tok.position,
            token=lexeme,
        )

    # ------------------------------------------------------------------
    # Grammar rules
    # ------------------------------------------------------------------

    def parse(self) -> Node:
        """Parse the full token stream and return the root node."""
        node = self._expression()
        end = self._peek()
        if end.kind != EOF:
            self._error("unexpected trailing input", end)
        return node

    def _expression(self) -> Node:
        """``expression := term (('+' | '-') term)*`` — left-associative."""
        node = self._term()
        while True:
            op_tok = self._match_op(_ADDITIVE_OPS)
            if op_tok is None:
                return node
            right = self._term_or_error(op_tok)
            node = BinaryOpNode(op=str(op_tok.value), left=node, right=right)

    def _term(self) -> Node:
        """``term := factor (('*' | '/' | '//' | '%') factor)*`` — left-assoc."""
        node = self._factor()
        while True:
            op_tok = self._match_op(_MULTIPLICATIVE_OPS)
            if op_tok is None:
                return node
            right = self._factor_or_error(op_tok)
            node = BinaryOpNode(op=str(op_tok.value), left=node, right=right)

    def _factor(self) -> Node:
        """``factor := '-' factor | power`` — unary minus, Python-style.

        Unary minus consumed *here* sits **outside** the ``**`` on the
        left, so ``-2**2`` parses as ``-(2**2)``. A leading ``+`` is not
        in the language — it would fall through to ``_atom`` and raise.
        """
        tok = self._peek()
        if tok.kind == OP and tok.value == "-":
            op_tok = self._advance()
            operand = self._factor_or_error(op_tok)
            return UnaryOpNode(op="-", operand=operand)
        return self._power()

    def _power(self) -> Node:
        """``power := postfix ('**' factor | '^' factor)?`` — right-assoc.

        The right operand recurses via ``_factor`` (not ``_power``) so
        that nested ``**`` chains group right-to-left (``2**3**2`` →
        ``2 ** (3 ** 2)``) AND so that a unary minus on the right binds
        tighter than the ``**`` itself (``2**-3`` → ``2 ** (-3)``).
        """
        left = self._postfix()
        op_tok = self._match_op(_POWER_OPS)
        if op_tok is None:
            return left
        right = self._factor_or_error(op_tok)
        return BinaryOpNode(op=str(op_tok.value), left=left, right=right)

    def _postfix(self) -> Node:
        """``postfix := atom ('!')*`` — left-folds factorials."""
        node = self._atom()
        while self._peek().kind == BANG:
            self._advance()
            node = UnaryOpNode(op="!", operand=node)
        return node

    def _atom(self) -> Node:
        """``atom := NUMBER | IDENT call? | '(' expression ')'``."""
        tok = self._peek()

        if tok.kind == NUMBER:
            self._advance()
            # ``Token.value`` for NUMBER tokens is already a float (see
            # tokenizer); cast defensively in case a future Token type
            # widens.
            return NumberNode(value=float(tok.value))

        if tok.kind == IDENT:
            self._advance()
            name = str(tok.value)
            # Optional call: identifier directly followed by '('.
            if self._peek().kind == LPAREN:
                return self._call_tail(name)
            return IdentNode(name=name)

        if tok.kind == LPAREN:
            lparen = self._advance()
            # Reject empty parens — ``()`` is not a valid atom.
            if self._peek().kind == RPAREN:
                self._error("empty parentheses", self._peek())
            inner = self._expression()
            if self._peek().kind != RPAREN:
                # Report the unmatched paren at the position of whatever
                # we actually got (often EOF), which makes "(1+2" point
                # at the position past the last consumed token.
                self._error("expected ')'", self._peek())
            self._advance()  # consume ')'
            # Suppress unused-variable warnings on lparen.
            del lparen
            return inner

        # Anything else at atom position is an error.
        self._error("expected expression", tok)
        # Unreachable — _error always raises — but appeases type checkers.
        raise AssertionError  # pragma: no cover

    def _call_tail(self, name: str) -> Node:
        """Parse the ``'(' arglist? ')'`` portion of a function call.

        Assumes the current token is ``LPAREN``.
        """
        self._advance()  # consume '('
        args: list[Node] = []
        if self._peek().kind != RPAREN:
            args.append(self._expression())
            while self._peek().kind == COMMA:
                comma = self._advance()
                # Disallow trailing comma / stray comma — the next token
                # must start an expression.
                if self._peek().kind == RPAREN:
                    self._error("expected expression after ','", self._peek())
                # Track ``comma`` only for clarity; not used further.
                del comma
                args.append(self._expression())
        if self._peek().kind != RPAREN:
            self._error("expected ')'", self._peek())
        self._advance()  # consume ')'
        return CallNode(name=name, args=args)

    # ------------------------------------------------------------------
    # Error wrappers — give precise positions for missing operands.
    # ------------------------------------------------------------------

    def _term_or_error(self, op_tok: Token) -> Node:
        return self._operand_or_error(self._term, op_tok)

    def _factor_or_error(self, op_tok: Token) -> Node:
        return self._operand_or_error(self._factor, op_tok)

    def _operand_or_error(self, rule, op_tok: Token) -> Node:
        """Run a sub-rule, re-raising a missing-operand error pointing at
        the position of the operator if the sub-rule failed at EOF.

        This keeps positions tight: ``1+`` reports the error at the
        position of the trailing EOF (right after the ``+``), and ``*2``
        reports it at the position of ``*``.
        """
        # If the next token is EOF, we know the operand is missing.
        if self._peek().kind == EOF:
            self._error(
                f"missing operand after '{op_tok.value}'",
                self._peek(),
            )
        return rule()


def parse(tokens: list[Token]) -> Node:
    """Parse a token list (as produced by ``tokenize``) into an AST.

    The token list MUST end in an ``EOF`` token — :func:`tokenize`
    always guarantees this.

    Args:
        tokens: The token list to parse.

    Returns:
        The root :data:`~scientific_calculator.ast_nodes.Node`.

    Raises:
        SyntaxErrorCalc: If the token stream is not a valid expression
            under the grammar documented in this module's docstring.
            ``position`` is the zero-based source offset of the
            offending token; ``token`` is its lexeme.
    """
    if not tokens or tokens[-1].kind != EOF:
        # Defensive: tokenize() always appends EOF, but guard anyway so
        # a hand-crafted token list still produces a useful error.
        pos = tokens[-1].position if tokens else 0
        raise SyntaxErrorCalc(
            message="token stream must end with EOF",
            position=pos,
            token=None,
        )
    return _Parser(tokens).parse()


__all__ = [
    "parse",
]
