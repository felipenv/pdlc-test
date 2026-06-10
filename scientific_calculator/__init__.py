"""Scientific calculator package.

Public surface:
    - :func:`evaluate` — entry point that evaluates a single expression string.
    - :class:`CalculatorError` and subclasses — the typed exception hierarchy
      raised by the tokenizer, parser, evaluator, and CLI layers.

The ``evaluate`` symbol is forward-declared as a stub until the API story
lands.  Importing the package and the exception classes is fully supported
today so downstream tokenizer/parser/evaluator stories can build against
a stable surface.
"""

from __future__ import annotations

from .errors import (
    CalculatorError,
    DomainErrorCalc,
    SyntaxErrorCalc,
    UnknownSymbolError,
)
from .tokenizer import (
    BANG,
    COMMA,
    EOF,
    IDENT,
    LPAREN,
    NUMBER,
    OP,
    RPAREN,
    TOKEN_KINDS,
    Token,
    tokenize,
)
from .ast_nodes import (
    BinaryOpNode,
    CallNode,
    IdentNode,
    Node,
    NumberNode,
    UnaryOpNode,
)
from .parser import parse

__version__ = "0.1.0"

__all__ = [
    "__version__",
    "evaluate",
    "CalculatorError",
    "SyntaxErrorCalc",
    "DomainErrorCalc",
    "UnknownSymbolError",
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
    "Node",
    "NumberNode",
    "IdentNode",
    "UnaryOpNode",
    "BinaryOpNode",
    "CallNode",
    "parse",
]


def evaluate(expression: str) -> float:
    """Evaluate a scientific-calculator expression and return its value.

    This is a forward-declared stub. The real implementation is delivered
    by a later story that wires the tokenizer, parser, and evaluator
    together. Calling it today always raises :class:`NotImplementedError`
    so downstream code can import the symbol but cannot accidentally
    rely on a fake result.

    Args:
        expression: The infix expression to evaluate.

    Returns:
        The numeric value of ``expression`` as a ``float``.

    Raises:
        NotImplementedError: Always — the evaluator is not wired up yet.
    """
    raise NotImplementedError(
        "scientific_calculator.evaluate is not implemented yet; "
        "it will be wired up by a later story."
    )
