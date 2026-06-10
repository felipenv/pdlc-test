"""AST node types produced by :mod:`scientific_calculator.parser`.

The parser turns a flat :class:`~scientific_calculator.tokenizer.Token` list
into a tree of node objects defined here. The evaluator walks that tree to
compute a numeric value — the AST is the contract between the two layers.

Design notes
------------
- Every node is a ``@dataclass(frozen=True)``. ``frozen=True`` makes node
  instances hashable and immutable; the default ``eq=True`` gives us
  value-based equality, which the parser tests rely on (e.g. comparing
  ``BinaryOpNode("+", NumberNode(1.0), NumberNode(2.0))`` directly).
- Node types are deliberately small. The parser owns precedence and
  associativity; nodes only carry the structural data. Operator strings
  match the token lexemes verbatim (``"+"``, ``"-"``, ``"*"``, ``"/"``,
  ``"//"``, ``"%"``, ``"**"``, ``"^"``, ``"!"``).
- ``UnaryOpNode`` covers both prefix unary minus (``op="-"``) and postfix
  factorial (``op="!"``). The evaluator dispatches on ``op``.
- ``CallNode.args`` is a Python ``list`` (not a tuple) for downstream
  convenience. Lists are not hashable, so ``CallNode`` instances are not
  hashable in practice — that's fine: equality still works, and we don't
  put AST nodes in sets.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Union


@dataclass(frozen=True)
class NumberNode:
    """A numeric literal. ``value`` is the parsed :class:`float`."""

    value: float


@dataclass(frozen=True)
class IdentNode:
    """A bare identifier — a constant (``pi``), variable (``ans``), or
    memory command (``M+``)."""

    name: str


@dataclass(frozen=True)
class UnaryOpNode:
    """A unary operator applied to a single operand.

    Covers prefix unary minus (``op="-"``) and postfix factorial
    (``op="!"``). The evaluator distinguishes the two by inspecting
    ``op``.
    """

    op: str
    operand: "Node"


@dataclass(frozen=True)
class BinaryOpNode:
    """A binary operator with a left and right operand."""

    op: str
    left: "Node"
    right: "Node"


@dataclass(frozen=True)
class CallNode:
    """A function call. ``args`` is a list of zero or more argument
    expressions (the parser currently accepts one or two args per the
    grammar; the node type itself does not enforce that — the evaluator
    validates arity per function)."""

    name: str
    args: list["Node"] = field(default_factory=list)


# Union alias for any AST node — useful for type hints in the parser
# and evaluator. Kept as a string-friendly union (PEP 604 style).
Node = Union[NumberNode, IdentNode, UnaryOpNode, BinaryOpNode, CallNode]


__all__ = [
    "Node",
    "NumberNode",
    "IdentNode",
    "UnaryOpNode",
    "BinaryOpNode",
    "CallNode",
]
