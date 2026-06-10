"""Tests for :mod:`scientific_calculator.parser`.

Pins down the parsing contract: precedence, associativity, the
Python-style ``-2**2`` rule, postfix factorial, function calls (1- and
2-arg), parens override, and that :class:`SyntaxErrorCalc` is raised at
the right position for every documented failure mode.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from scientific_calculator import (
    BinaryOpNode,
    CallNode,
    IdentNode,
    NumberNode,
    SyntaxErrorCalc,
    UnaryOpNode,
    parse,
    tokenize,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse(src: str):
    return parse(tokenize(src))


# ---------------------------------------------------------------------------
# Acceptance criteria
# ---------------------------------------------------------------------------


def test_addition_and_multiplication_precedence() -> None:
    # 1 + 2*3 → +(1, *(2,3))
    tree = _parse("1+2*3")
    assert tree == BinaryOpNode(
        op="+",
        left=NumberNode(1.0),
        right=BinaryOpNode(op="*", left=NumberNode(2.0), right=NumberNode(3.0)),
    )


def test_power_is_right_associative() -> None:
    # 2**3**2 → **(2, **(3, 2))
    tree = _parse("2**3**2")
    assert tree == BinaryOpNode(
        op="**",
        left=NumberNode(2.0),
        right=BinaryOpNode(op="**", left=NumberNode(3.0), right=NumberNode(2.0)),
    )


def test_unary_minus_python_semantics() -> None:
    # -2**2 → -(**(2,2))  (Python: -2**2 == -4)
    tree = _parse("-2**2")
    assert tree == UnaryOpNode(
        op="-",
        operand=BinaryOpNode(op="**", left=NumberNode(2.0), right=NumberNode(2.0)),
    )


def test_postfix_factorial_simple() -> None:
    # 5! → !(5)
    tree = _parse("5!")
    assert tree == UnaryOpNode(op="!", operand=NumberNode(5.0))


def test_postfix_factorial_chained() -> None:
    # 3!! → !(!(3)), left-folded
    tree = _parse("3!!")
    assert tree == UnaryOpNode(
        op="!", operand=UnaryOpNode(op="!", operand=NumberNode(3.0))
    )


def test_function_call_two_args() -> None:
    tree = _parse("log_b(8, 2)")
    assert tree == CallNode(
        name="log_b", args=[NumberNode(8.0), NumberNode(2.0)]
    )


def test_function_call_one_arg() -> None:
    tree = _parse("sin(x)")
    assert tree == CallNode(name="sin", args=[IdentNode("x")])


def test_bare_identifier() -> None:
    tree = _parse("pi")
    assert tree == IdentNode("pi")


def test_parens_override_precedence() -> None:
    # (1+2)*3 → *(+(1,2), 3)
    tree = _parse("(1+2)*3")
    assert tree == BinaryOpNode(
        op="*",
        left=BinaryOpNode(op="+", left=NumberNode(1.0), right=NumberNode(2.0)),
        right=NumberNode(3.0),
    )


# ---------------------------------------------------------------------------
# Associativity for the other operators
# ---------------------------------------------------------------------------


def test_subtraction_is_left_associative() -> None:
    # 1-2-3 → -(- (1,2), 3)
    tree = _parse("1-2-3")
    assert tree == BinaryOpNode(
        op="-",
        left=BinaryOpNode(op="-", left=NumberNode(1.0), right=NumberNode(2.0)),
        right=NumberNode(3.0),
    )


def test_division_is_left_associative() -> None:
    # 8/4/2 → /(/(8,4), 2)
    tree = _parse("8/4/2")
    assert tree == BinaryOpNode(
        op="/",
        left=BinaryOpNode(op="/", left=NumberNode(8.0), right=NumberNode(4.0)),
        right=NumberNode(2.0),
    )


def test_caret_aliases_double_star() -> None:
    # ^ is right-associative just like **
    tree = _parse("2^3^2")
    assert tree == BinaryOpNode(
        op="^",
        left=NumberNode(2.0),
        right=BinaryOpNode(op="^", left=NumberNode(3.0), right=NumberNode(2.0)),
    )


def test_floor_div_and_mod_are_multiplicative() -> None:
    # 7//2%3 → %(//(7,2), 3)
    tree = _parse("7//2%3")
    assert tree == BinaryOpNode(
        op="%",
        left=BinaryOpNode(op="//", left=NumberNode(7.0), right=NumberNode(2.0)),
        right=NumberNode(3.0),
    )


def test_double_unary_minus() -> None:
    # --3 → -(-(3))
    tree = _parse("--3")
    assert tree == UnaryOpNode(
        op="-", operand=UnaryOpNode(op="-", operand=NumberNode(3.0))
    )


def test_unary_minus_binds_inside_power_right() -> None:
    # 2**-3 → **(2, -(3))
    tree = _parse("2**-3")
    assert tree == BinaryOpNode(
        op="**",
        left=NumberNode(2.0),
        right=UnaryOpNode(op="-", operand=NumberNode(3.0)),
    )


def test_factorial_then_power() -> None:
    # 3!**2 → factorial binds tighter than ** on the left → **(!(3), 2)
    tree = _parse("3!**2")
    assert tree == BinaryOpNode(
        op="**",
        left=UnaryOpNode(op="!", operand=NumberNode(3.0)),
        right=NumberNode(2.0),
    )


# ---------------------------------------------------------------------------
# Error positions
# ---------------------------------------------------------------------------


def test_trailing_input_raises_at_extra_token() -> None:
    # "1+2 3" — after parsing 1+2, the next token is NUMBER(3) at pos 4.
    with pytest.raises(SyntaxErrorCalc) as excinfo:
        _parse("1+2 3")
    err = excinfo.value
    assert err.position == 4
    assert "trailing" in err.message.lower()


def test_unmatched_open_paren_raises_at_eof() -> None:
    # "(1+2" — EOF is at position len(source) == 4.
    src = "(1+2"
    with pytest.raises(SyntaxErrorCalc) as excinfo:
        _parse(src)
    err = excinfo.value
    assert err.position == len(src)
    assert ")" in err.message


def test_missing_right_operand_raises_at_eof() -> None:
    # "1+" — operand expected after '+'; EOF is at position 2.
    src = "1+"
    with pytest.raises(SyntaxErrorCalc) as excinfo:
        _parse(src)
    err = excinfo.value
    assert err.position == len(src)
    assert "operand" in err.message.lower()


def test_leading_binary_op_raises_at_op() -> None:
    # "*2" — atom expected; the '*' is at position 0.
    with pytest.raises(SyntaxErrorCalc) as excinfo:
        _parse("*2")
    err = excinfo.value
    assert err.position == 0


def test_empty_parens_raises_at_rparen() -> None:
    # "()" — empty parens are not a valid atom; ')' is at position 1.
    with pytest.raises(SyntaxErrorCalc) as excinfo:
        _parse("()")
    err = excinfo.value
    assert err.position == 1


def test_stray_comma_in_call_raises_at_comma() -> None:
    # "f(,)" — atom expected after '('; the ',' is at position 2.
    with pytest.raises(SyntaxErrorCalc) as excinfo:
        _parse("f(,)")
    err = excinfo.value
    assert err.position == 2


def test_trailing_comma_in_call_raises_at_rparen() -> None:
    # "f(1,)" — expression expected after ','; ')' is at position 4.
    with pytest.raises(SyntaxErrorCalc) as excinfo:
        _parse("f(1,)")
    err = excinfo.value
    assert err.position == 4


def test_unmatched_paren_in_call_raises() -> None:
    # "f(1" — expected ')' after the arg; EOF at position 3.
    src = "f(1"
    with pytest.raises(SyntaxErrorCalc) as excinfo:
        _parse(src)
    err = excinfo.value
    assert err.position == len(src)


# ---------------------------------------------------------------------------
# Safety contract — parser source must not call eval/exec/compile or
# import stdlib tokenize. Mirrors the tokenizer's safety test.
# ---------------------------------------------------------------------------


def test_parser_source_does_not_use_unsafe_primitives() -> None:
    source_path = (
        Path(__file__).resolve().parent.parent
        / "scientific_calculator"
        / "parser.py"
    )
    src = source_path.read_text(encoding="utf-8")

    # Strip the module docstring so prose mentioning forbidden names
    # doesn't trip the check.
    stripped = re.sub(r'^"""[\s\S]*?"""', "", src, count=1)

    for forbidden in ("eval", "exec", "compile"):
        pattern = rf"(?<![A-Za-z0-9_.]){forbidden}\("
        assert not re.search(pattern, stripped), (
            f"parser.py must not call the builtin {forbidden}()"
        )

    assert not re.search(r"^\s*import\s+tokenize\b", stripped, re.MULTILINE)
    assert not re.search(r"^\s*from\s+tokenize\b", stripped, re.MULTILINE)
