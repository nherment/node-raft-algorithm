
This lib is work in progress and barely usable yet. Quality contributions are
welcome.

RAFT
====

Raft is a consensus algorithm like Plaxo but working with a master-slave scheme.
See an abstract [here](docs/raft.pdf) and an analysis
[here](docs/Analysis_of_Raft_Consensus.pdf)

What is this module ?
=====================

This library mainly implements the consensus algorithm and an API to interact
with it. Additional to that, it provides:

- a default transport mechanism based on [thrift](https://thrift.apache.org/)
- a clean API to synchronize processes or servers

Using this library implies you understand RAFT.

