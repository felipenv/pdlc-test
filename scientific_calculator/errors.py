"""Exception hierarchy for the scientific calculator package.

All errors raised by the tokenizer, parser, evaluator, and CLI layers
inherit from :class:`CalculatorError` so callers can catch the whole
calculator-specific surface with a single ``except``.
"""

from __future__ import annotations


class CalculatorError(Exception):
    """Base class for all calculator-specific errors."""


class SyntaxErrorCalc(CalculatorError):
    """Raised when the input expression is syntactically invalid.

    Attributes:
        position: Zero-based character offset in the source expression
            where the syntax problem was detected.
        token: The offending token text, or ``None`` if the error was
            detected without a concrete token (e.g. unexpected end of
            input).
    """

    def __init__(
        self,
        message: str,
        position: int,
        token: str | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.position = position
        self.token = token

    def __str__(self) -> str:
        return f"{self.message} at position {self.position}: {self.token}"


class DomainErrorCalc(CalculatorError):
    """Raised for math domain failures.

    Examples include ``sqrt(-1)``, ``log(0)``, ``asin(2)``, and division
    by zero — cases where the inputs are syntactically valid but the
    mathematical operation is undefined.
    """


class UnknownSymbolError(CalculatorError):
    """Raised when the expression references an unknown identifier.

    Attributes:
        name: The offending identifier as it appeared in the source.
    """

    def __init__(self, name: str, message: str | None = None) -> None:
        super().__init__(message if message is not None else f"unknown symbol: {name}")
        self.name = name
