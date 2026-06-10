"""Tests for :mod:`scientific_calculator.tokenizer`.

These tests pin down the lexical contract: token kind sequence,
numeric-literal parsing, multi-character operators, the ``M+``
boundary rule, and the safe-by-construction invariant (no ``eval``,
``exec``, ``compile``, or stdlib ``tokenize`` on the input).
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from scientific_calculator import (
    BANG,
    COMMA,
    EOF,
    IDENT,
    LPAREN,
    NUMBER,
    OP,
    RPAREN,
    SyntaxErrorCalc,
    Token,
    tokenize,
)


# ---------------------------------------------------------------------------
# Acceptance-criteria fixture
# ---------------------------------------------------------------------------


def _kinds(tokens: list[Token]) -> list[str]:
    return [t.kind for t in tokens]


def test_acceptance_kind_sequence() -> None:
    tokens = tokenize("2 + 3*sin(pi/4)")
    assert _kinds(tokens) == [
        NUMBER,
        OP,
        NUMBER,
        OP,
        IDENT,
        LPAREN,
        IDENT,
        OP,
        NUMBER,
        RPAREN,
        EOF,
    ]
    numbers = [t.value for t in tokens if t.kind == NUMBER]
    assert numbers == [2.0, 3.0, 4.0]
    # All numbers are real floats, not ints.
    assert all(isinstance(v, float) for v in numbers)


def test_eof_token_is_always_appended() -> None:
    tokens = tokenize("")
    assert len(tokens) == 1
    assert tokens[0].kind == EOF
    assert tokens[0].position == 0


def test_eof_position_matches_source_length() -> None:
    src = "1 + 2"
    tokens = tokenize(src)
    assert tokens[-1].kind == EOF
    assert tokens[-1].position == len(src)


# ---------------------------------------------------------------------------
# Numeric literals
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "source, expected",
    [
        ("1", 1.0),
        ("1.5", 1.5),
        ("1.5e10", 1.5e10),
        ("1.5E-3", 1.5e-3),
        (".25", 0.25),
        ("2e+3", 2e3),
        ("42.", 42.0),
        ("0", 0.0),
    ],
)
def test_number_literals(source: str, expected: float) -> None:
    tokens = tokenize(source)
    assert _kinds(tokens) == [NUMBER, EOF]
    assert tokens[0].value == pytest.approx(expected)
    assert isinstance(tokens[0].value, float)


def test_number_position_recorded() -> None:
    tokens = tokenize("   3.14")
    assert tokens[0].kind == NUMBER
    assert tokens[0].position == 3


# ---------------------------------------------------------------------------
# Multi-character operators
# ---------------------------------------------------------------------------


def test_double_star_is_single_token() -> None:
    tokens = tokenize("2**3")
    assert _kinds(tokens) == [NUMBER, OP, NUMBER, EOF]
    assert tokens[1].value == "**"


def test_double_slash_is_single_token() -> None:
    tokens = tokenize("7//2")
    assert _kinds(tokens) == [NUMBER, OP, NUMBER, EOF]
    assert tokens[1].value == "//"


def test_double_slash_not_confused_with_two_slashes_around_space() -> None:
    tokens = tokenize("7 / / 2")
    ops = [t.value for t in tokens if t.kind == OP]
    assert ops == ["/", "/"]


@pytest.mark.parametrize("op", ["+", "-", "*", "/", "%", "^"])
def test_single_char_operators(op: str) -> None:
    tokens = tokenize(f"1{op}2")
    assert _kinds(tokens) == [NUMBER, OP, NUMBER, EOF]
    assert tokens[1].value == op


def test_unary_minus_is_plain_op_token() -> None:
    # The tokenizer never folds a leading "-" into a NUMBER.  The parser
    # is responsible for interpreting unary minus.
    tokens = tokenize("-3")
    assert _kinds(tokens) == [OP, NUMBER, EOF]
    assert tokens[0].value == "-"
    assert tokens[1].value == 3.0


# ---------------------------------------------------------------------------
# Identifiers and constants
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("name", ["pi", "e", "ans", "log_b", "sqrt", "sin"])
def test_identifiers(name: str) -> None:
    tokens = tokenize(name)
    assert _kinds(tokens) == [IDENT, EOF]
    assert tokens[0].value == name


def test_identifier_with_digits_after_first_char() -> None:
    tokens = tokenize("x1")
    assert _kinds(tokens) == [IDENT, EOF]
    assert tokens[0].value == "x1"


# ---------------------------------------------------------------------------
# M+ boundary rule
# ---------------------------------------------------------------------------


def test_m_plus_at_end_of_input_is_single_ident() -> None:
    tokens = tokenize("M+")
    assert _kinds(tokens) == [IDENT, EOF]
    assert tokens[0].value == "M+"
    assert tokens[0].position == 0


def test_m_plus_followed_by_whitespace_is_single_ident() -> None:
    tokens = tokenize("M+ ")
    assert _kinds(tokens) == [IDENT, EOF]
    assert tokens[0].value == "M+"


def test_m_with_explicit_space_before_plus_splits() -> None:
    tokens = tokenize("M + 1")
    assert _kinds(tokens) == [IDENT, OP, NUMBER, EOF]
    assert tokens[0].value == "M"
    assert tokens[1].value == "+"
    assert tokens[2].value == 1.0


def test_m_plus_directly_followed_by_digit_splits() -> None:
    # "M+1" is arithmetic on a variable called "M", not the memory-add
    # command.
    tokens = tokenize("M+1")
    assert _kinds(tokens) == [IDENT, OP, NUMBER, EOF]
    assert tokens[0].value == "M"
    assert tokens[1].value == "+"
    assert tokens[2].value == 1.0


@pytest.mark.parametrize("name", ["MS", "MR", "MC"])
def test_other_memory_commands_are_plain_idents(name: str) -> None:
    tokens = tokenize(name)
    assert _kinds(tokens) == [IDENT, EOF]
    assert tokens[0].value == name


# ---------------------------------------------------------------------------
# Punctuation and factorial
# ---------------------------------------------------------------------------


def test_punctuation_and_factorial() -> None:
    tokens = tokenize("log_b(x, 2)!")
    assert _kinds(tokens) == [
        IDENT,
        LPAREN,
        IDENT,
        COMMA,
        NUMBER,
        RPAREN,
        BANG,
        EOF,
    ]
    assert tokens[0].value == "log_b"
    assert tokens[2].value == "x"
    assert tokens[4].value == 2.0
    assert tokens[6].value == "!"


def test_whitespace_is_skipped_between_tokens() -> None:
    tokens = tokenize("  1   +\t2 \n")
    assert _kinds(tokens) == [NUMBER, OP, NUMBER, EOF]


# ---------------------------------------------------------------------------
# Error reporting
# ---------------------------------------------------------------------------


def test_unrecognized_character_raises_with_position() -> None:
    with pytest.raises(SyntaxErrorCalc) as excinfo:
        tokenize("2 + @")
    err = excinfo.value
    assert err.position == 4
    assert err.token == "@"
    assert err.message == "unexpected character"


def test_unrecognized_character_position_at_start() -> None:
    with pytest.raises(SyntaxErrorCalc) as excinfo:
        tokenize("$x")
    err = excinfo.value
    assert err.position == 0
    assert err.token == "$"


# ---------------------------------------------------------------------------
# Safety contract — tokenizer source code must not call eval/exec/compile
# or import the stdlib ``tokenize`` module.
# ---------------------------------------------------------------------------


def test_tokenizer_source_does_not_use_unsafe_primitives() -> None:
    source_path = (
        Path(__file__).resolve().parent.parent
        / "scientific_calculator"
        / "tokenizer.py"
    )
    src = source_path.read_text(encoding="utf-8")

    # Strip the module docstring before scanning so that the safety
    # contract documented in prose doesn't trigger a false positive.
    stripped = re.sub(r'^"""[\s\S]*?"""', "", src, count=1)

    # Look for unqualified calls to the dangerous builtins.  A leading
    # ``.`` (e.g. ``re.compile(``) or alphanumeric prefix means it's a
    # different function — only the bare builtin is forbidden.
    for forbidden in ("eval", "exec", "compile"):
        pattern = rf"(?<![A-Za-z0-9_.]){forbidden}\("
        assert not re.search(pattern, stripped), (
            f"tokenizer.py must not call the builtin {forbidden}()"
        )

    # The stdlib ``tokenize`` module must not be imported at all.
    assert not re.search(r"^\s*import\s+tokenize\b", stripped, re.MULTILINE)
    assert not re.search(r"^\s*from\s+tokenize\b", stripped, re.MULTILINE)
