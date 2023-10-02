<img src="https://docs.momentohq.com/img/logo.svg" alt="logo" width="400"/>

[![project status](https://momentohq.github.io/standards-and-practices/badges/project-status-official.svg)](https://github.com/momentohq/standards-and-practices/blob/main/docs/momento-on-github.md)
[![project stability](https://momentohq.github.io/standards-and-practices/badges/project-stability-alpha.svg)](https://github.com/momentohq/standards-and-practices/blob/main/docs/momento-on-github.md) 

# Momento-Sequelize Read Aside Cache Client

## What and why?

This project provides a Momento-backed read-aside caching implemenation for [sequelize](https://github.com/sequelize/sequelize).
The goal is to provide an interface for caching [sequelize](https://github.com/sequelize/sequelize) queries.

You can use Momento as your caching engine for any relational databases that are a part of sequelize's [dialects](https://sequelize.org/docs/v6/getting-started/).

## Prerequisites

- To use this library, you will need a Momento API key. You can generate one using the [Momento Console](https://console.gomomento.com/).
- The examples use two caches `Users` and `UserGroups` that you will need to create in your Momento account. You can create 
them on the [console](https://console.gomomento.com/) as well! 
- The examples will utilize your API key via the environment variable `MOMENTO_API_KEY` you set.


## Usage

```typescript

import { Sequelize, DataTypes } from 'sequelize';
import { Configurations, CredentialProvider } from "@gomomento/sdk";
import { modelCacheFactory } from "../src";
import { MomentoClientGenerator } from "../src";
import { LoggerFactory } from "../src";

const userSchema = {
    username: {
        type: DataTypes.STRING,
    },
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    birthday: DataTypes.DATE,
    age: DataTypes.INTEGER,
    isActive: DataTypes.BOOLEAN,
    accountBalance: DataTypes.FLOAT,
};

const User = sequelize.define("User", userSchema);

async function insertUser(username: string, birthday: Date, age: number, isActive: boolean, accountBalance: number) {
    await User.create({ username, birthday, age, isActive, accountBalance });
}

async function doWork() {


    await User.sync({force: true});
    await UserGroup.sync({force: true});
    
    const birthday = new Date(Date.UTC(1992, 5, 21));
    const age = 29;
    const isActive = true;
    const accountBalance = 70.07;

    // prepare the data; in real world these will happen elsewhere and we will be employing this project
    // primarily as a read-aside cache
    await insertUser('user1', birthday, age, isActive, accountBalance);
    await insertUser('user2', birthday, age, isActive, accountBalance);

    // prepare momento model cache client
    const momentoClient = MomentoClientGenerator.getInstance({
        configuration: Configurations.Laptop.latest(),
        credentialProvider: CredentialProvider.fromEnvironmentVariable({environmentVariableName: 'MOMENTO_API_KEY'}),
        defaultTtlSeconds: 60,
    });

    const log = LoggerFactory.createLogger({ logLevel: 'debug' })
    const momentoSequelizeClient = await modelCacheFactory(momentoClient, log);

    log.debug({ userId : 1 }, "Issuing a read for one user findByPk")
    const UserFoundByPK = await momentoSequelizeClient.wrap(User).findByPk(1)
    log.debug({user: JSON.stringify(UserFoundByPK)}, "Found user: ");
    

    const UserFindAll = await momentoSequelizeClient.wrap(User).findAll();
    log.debug({user: JSON.stringify(UserFindAll)}, "Found users: ");

}

doWork().catch(console.error);
```

You can find an example with more commands in our [examples directory](./examples).

## About the interface and mutating commands

The wrapper or interface provides a wrapper over the below `sequelize` operations:
The wrapper or interface provides a wrapper over the below `sequelize` operations:

- `findOne()`
- `findByPK()`
- `findAll()`
- `count()`

When you make a query using the interface, you need to provide your sequelize model, such as `User` in the below command:

```typescript
    const userFoundByPK = await momentoSequelizeClient.wrap(User).findByPk(1)
```

There are 3 things this command will do:
- First query your Momento cache `Users` with an `id` (primary key) of `1`. Note that a Momento cache with the name
`Users` should exist in your account.
- If there's a cache miss, it queries your database with a table `Users` using the sequelize `Model` that you provided.
- It stores the result of the query in Momento using a custom cache key that mimics the sequelize query. For instance,
the above `findByPk` query will translate to a cache key:

`model-cache:findByPk:Users:{"where":{"id":1}}`

Any future calls to the **same** query will result in a cache hit until the key expires.

The return type of the call is one or more instances of the sequelize model that matches the query. Sequelize models by default 
have commands such as `save()`, `destroy()`, `update()` that you'd potentially not want to be exposed from your returned 
cache instance. Therefore, the returned type will only allow to access the attributes directly through an `attributeName`,
such as `userFoundByPK.username` or through an accessor such as `userFoundByPK.get('username')`. 
Any non-existent attributes or a method other than `get()` will result in a `TypeError`.
