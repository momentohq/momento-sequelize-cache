<img src="https://docs.momentohq.com/img/logo.svg" alt="logo" width="400"/>

[![project status](https://momentohq.github.io/standards-and-practices/badges/project-status-official.svg)](https://github.com/momentohq/standards-and-practices/blob/main/docs/momento-on-github.md)
[![project stability](https://momentohq.github.io/standards-and-practices/badges/project-stability-alpha.svg)](https://github.com/momentohq/standards-and-practices/blob/main/docs/momento-on-github.md)

# Momento-Sequelize Read Aside Cache Client Examples

## Prerequisites

- Node version 14 or higher is required
- To use the examples, you will need a Momento API key. You can generate one using the [Momento Console](https://console.gomomento.com/). 
The examples will utilize your API key via the environment variable `MOMENTO_API_KEY` you set.

To run any of the examples you will need to install the dependencies once first:

```bash
npm install
```

## Running the Basic Example

This example demonstrates insert and select from Momento or your underlying database (on a cache Miss). 

```bash
# Run example code
MOMENTO_API_KEY=<YOUR API KEY> npm run basic
```

Example Code: [basic.ts](basic.ts)
