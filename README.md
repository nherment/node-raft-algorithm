
This lib is work in progress and not usable yet. Quality contributions are
welcome.

RAFT
====

Raft is a consensus algorithm simpler than Plaxo. See an abstract
[here](docs/raft.pdf).

What this is
============

This library only implements the consensus algorithm and an API to interact with
it. It **does not** provide:

- a transport mechanism
- a clean API to synchronize processes or servers

Using this library implies you understand RAFT.
