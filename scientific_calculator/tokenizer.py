"""Safe lexical analyser for scientific-calculator expressions.

This module turns an expression string into a flat list of :class:`Token`
objects that the parser consumes.  The implementation is intentionally
hand-written and works exclusively with character-level operations: it
**never** calls :func:`eval`, :func:`exec`, :func:`compile`, or
:mod:`tokenize` on the input.  Untrusted strings cannot trigger code
execution through this layer.

Grammar handled at the lexical level
------------------------------------
- Numeric literals: integers, decimals, and scientific notation.  The
  matched lexeme is parsed with :func:`float` and stored in
  ``Token.value``.
- Identifiers: ``[A-Za-z_][A-Za-z_0-9]*``.  This covers functions
  (``sin``, ``sqrt``, ``log_b``), constants (``pi``, ``e``), the
  variable ``ans``, and memory commands (``MS``, ``MR``, ``MC``).
- Operators: ``**`` and ``//`` are matched greedily before the
  single-character operators ``+ - * / % ^``.
- Punctuation: ``(``, ``)``, ``,``, ``!``.
- Unary minus is **not** a tokenizer concern — ``-`` is always emitted
  as ``OP("-")`` and the parser disambiguates unary vs. binary use.

``M+`` handling
---------------
The memory-add command ``M+`` collides with the binary ``+`` operator.
We resolve the ambiguity at the lexer using a boundary rule: ``M`` is
fused with a following ``+`` into a single ``IDENT`` token with value
``"M+"`` only when the ``+`` is followed by end-of-input or whitespace.
In every other context (e.g. ``M + 1`` or ``M+1``) the scanner emits
``IDENT("M")`` followed by ``OP("+")`` and the rest of the stream is
tokenized normally.  This keeps ``M+`` usable as a standalone REPL
command without breaking arithmetic that happens to start with an ``M``
identifier.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Union

from .errors import SyntaxErrorCalc

# ---------------------------------------------------------------------------
# Token-kind constants.  Strings (rather than an Enum) keep the public API
# trivially serialisable and let downstream code compare against bare
# string literals when convenient.
# ---------------------------------------------------------------------------

NUMBER = "NUMBER"
IDENT = "IDENT"
OP = "OP"
LPAREN = "LPAREN"
RPAREN = "RPAREN"
COMMA = "COMMA"
BANG = "BANG"
EOF = "EOF"

TOKEN_KINDS: tuple[str, ...] = (
    NUMBER,
    IDENT,
    OP,
    LPAREN,
    RPAREN,
    COMMA,
    BANG,
    EOF,
)


@dataclass(frozen=True)
class Token:
    """A single lexical token.

    Attributes:
        kind: One of the values in :data:`TOKEN_KINDS`.
        value: For ``NUMBER`` tokens this is the parsed :class:`float`.
            For every other kind it is the original lexeme as a string
            (e.g. ``"+"``, ``"**"``, ``"sin"``, ``"M+"``, ``"("``).  The
            ``EOF`` sentinel carries an empty string.
        position: Zero-based offset of the first character of the lexeme
            in the original source string.  ``EOF`` uses ``len(source)``.
    """

    kind: str
    value: Union[str, float]
    position: int


# ---------------------------------------------------------------------------
# Pre-compiled scanner regexes.  We match against ``source`` with an
# explicit start position via the ``pos`` argument so we never need to
# slice the input.
# ---------------------------------------------------------------------------

_NUMBER_RE = re.compile(
    r"(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?"
)
_IDENT_RE = re.compile(r"[A-Za-z_][A-Za-z_0-9]*")

_SINGLE_CHAR_OPS: frozenset[str] = frozenset("+-*/%^")
_TWO_CHAR_OPS: tuple[str, ...] = ("**", "//")


def tokenize(source: str) -> list[Token]:
    """Convert ``source`` into a list of :class:`Token` objects.

    Args:
        source: The raw expression string to tokenize.

    Returns:
        A list of :class:`Token` instances ending with an ``EOF`` token
        positioned at ``len(source)``.

    Raises:
        SyntaxErrorCalc: If an unrecognized character is encountered.
            ``position`` is the zero-based offset of the bad character
            and ``token`` is the character itself.
    """

    tokens: list[Token] = []
    i = 0
    n = len(source)

    while i < n:
        ch = source[i]

        # Skip ASCII / Unicode whitespace.
        if ch.isspace():
            i += 1
            continue

        # Numbers — try this before identifiers so that ``.25`` works.
        m = _NUMBER_RE.match(source, i)
        if m is not None and (ch.isdigit() or ch == "."):
            lexeme = m.group(0)
            tokens.append(Token(kind=NUMBER, value=float(lexeme), position=i))
            i = m.end()
            continue

        # Identifiers (functions, constants, memory commands).
        m = _IDENT_RE.match(source, i)
        if m is not None:
            lexeme = m.group(0)
            start = i
            end = m.end()

            # Boundary rule for the memory-add command ``M+``: only fuse
            # when the ``+`` is the last meaningful char on the
            # statement (end-of-input or whitespace).
            if (
                lexeme == "M"
                and end < n
                and source[end] == "+"
                and (end + 1 == n or source[end + 1].isspace())
            ):
                tokens.append(Token(kind=IDENT, value="M+", position=start))
                i = end + 1
                continue

            tokens.append(Token(kind=IDENT, value=lexeme, position=start))
            i = end
            continue

        # Two-character operators, longest match first.
        if i + 1 < n:
            two = source[i : i + 2]
            if two in _TWO_CHAR_OPS:
                tokens.append(Token(kind=OP, value=two, position=i))
                i += 2
                continue

        # Single-character operators.
        if ch in _SINGLE_CHAR_OPS:
            tokens.append(Token(kind=OP, value=ch, position=i))
            i += 1
            continue

        # Punctuation.
        if ch == "(":
            tokens.append(Token(kind=LPAREN, value=ch, position=i))
            i += 1
            continue
        if ch == ")":
            tokens.append(Token(kind=RPAREN, value=ch, position=i))
            i += 1
            continue
        if ch == ",":
            tokens.append(Token(kind=COMMA, value=ch, position=i))
            i += 1
            continue
        if ch == "!":
            tokens.append(Token(kind=BANG, value=ch, position=i))
            i += 1
            continue

        # Anything else is a lexical error.
        raise SyntaxErrorCalc(
            message="unexpected character",
            position=i,
            token=ch,
        )

    tokens.append(Token(kind=EOF, value="", position=n))
    return tokens


__all__ = [
    "Token",
    "tokenize",
    "TOKEN_KINDS",
    "NUMBER",
    "IDENT",
    "OP",
    "LPAREN",
    "RPAREN",
    "COMMA",
    "BANG",
    "EOF",
]
