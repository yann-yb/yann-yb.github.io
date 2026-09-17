---
title: "About"
date: 2025-06-13
draft: false
---

# About Me

I began my software engineering career at Amadeus, a leading airline IT company based in France. I started as a C++ developer and later moved to the cloud team, where I worked on lift-and-shift migrations of the inventory service from on-premises infrastructure to Google Cloud Platform (GCP). I truly enjoyed my time there, as the Amadeus system was built almost like a textbook example of good architecture: an event bus, clear read/write segregation, a Memcached layer supporting large-scale transactions, robust C++ middleware, a single-repository model, and an elegant CI/CD pipeline.

The cloud team was founded around 2017, at a time when microservices architectures were already well established, but Kubernetes and container-native platforms like OpenShift were still emerging in enterprise production environments. My team laid a solid foundation for a microservices-based platform using modern technologies such as Kubernetes and OpenShift for orchestration, HAProxy for load balancing, Consul for service discovery, Couchbase as the database with tunable consistency levels, Helm and Terraform for infrastructure deployment, and Prometheus and Splunk for monitoring and observability. In addition, I worked on cloud cost optimization initiatives and led a Spark-based log analysis project.

Looking back, I consider Amadeus’s system to be the most elegant architecture I have worked with so far. I only wish I had explored it even more deeply and spent more time understanding the design decisions and the rationale behind them.

I then joined the Oracle Cloud Infrastructure (OCI) Network Dataplane team, a tier-0 service team. There, I grew tremendously in both technical depth and operational maturity under a manager who was an expert in Linux and networking. The scale was mind-blowing. We routinely reasoned about throughput in the order of Pbps and optimized packet processing down to the nanosecond level. Working with such powerful infrastructure gave me hands-on experience with large-scale distributed systems and taught me how to design for high availability and low latency in mission-critical environments. It also significantly boosted my confidence in handling complex challenges and production incidents.

I participated in multiple key projects, including:
1. **High-availability, fault-tolerant data plane** – Designed and implemented software supporting fast deployment, zero-downtime updates, and robust failover. This was the most valuable experience of my time on the team, providing deep exposure to distributed systems, reliability engineering, and production-scale networking infrastructure.
2. **Route distribution and forwarding state management** – Designed and implemented a dataplane route client that consumed BGP-learned routes from multiple route servers and maintained redundant forwarding tables to ensure high availability and uninterrupted packet forwarding during route server failures. This project deepened my understanding of control plane and data plane interactions, route distribution, and forwarding state management.
3. **Data plane packet processing and network policy enforcement** – Worked on Layer 3 packet processing, including encapsulation and decapsulation, route lookup, forwarding decisions, and ACL enforcement. Through this work, I gained broad experience with networking protocols, overlay networks, and high-performance packet processing systems.
4. **DPDK upgrade for multi-OS and hardware support** – Contributed to a major DPDK upgrade effort across multiple operating systems and hardware platforms. I gained practical insight into networking hardware and how DPDK achieves high-performance packet processing through kernel bypass, zero-copy techniques, customized NIC drivers, and ring-buffer-based architectures.
5. **Metrics and billing aggregation service in Go** – Built a metrics and billing aggregation service from scratch and evolved it into a standalone system. The service handled high-cardinality metrics while maintaining billing accuracy, and it provided my first experience owning a service end-to-end, from design and implementation to operation and maintenance.
6. **Infrastructure automation and CI/CD** – Automated infrastructure provisioning and deployment workflows, becoming proficient with infrastructure-as-code practices and learning operational best practices for reliability, scalability, and maintainability.

Beyond the technical growth, I deeply valued the team’s supportive and highly knowledgeable environment. If I could change one thing, I would have invested more effort into building professional relationships across a broader set of teams.

Now at NVIDIA, I am prioritizing personal networking and knowledge sharing alongside my technical work.
