import {DataTypes, Sequelize} from 'sequelize';
import {Configurations, CredentialProvider} from "@gomomento/sdk";
import {
    CompressionType,
    LoggerFactory,
    modelCacheFactory,
    MomentoClientGenerator
} from "@gomomento-poc/momento-sequelize-cache";

const sequelize = new Sequelize({ dialect: 'sqlite'});

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

const User = sequelize.define('User', userSchema);

const userGroupSchema = {
    group: DataTypes.STRING,
    UserId: {
        type: DataTypes.INTEGER,
        references: {
            model: User,
            key: 'id'
        }
    }
};

const UserGroup = sequelize.define("UserGroup", userGroupSchema);

// we create the 1-to-1 association here between users and groups
UserGroup.belongsTo(User, { foreignKey: 'UserId' });


async function insertUser(username: string, birthday: Date, age: number, isActive: boolean, accountBalance: number) {
    await User.create({ username, birthday, age, isActive, accountBalance });
}

async function insertUserInGroup(UserId: number, group: string) {
    await UserGroup.create({ UserId, group });
}

async function doWork() {

    await User.sync({force: true});
    await UserGroup.sync({force: true});

    const username = 'Alexa';
    const birthday = new Date(Date.UTC(1992, 5, 21));
    const age = 29;
    const isActive = true;
    const accountBalance = 70.07;

    // prepare the data; in real world these will happen elsewhere and we will be employing this project
    // primarily as a read-aside cache
    await insertUser(username, birthday, age, isActive, accountBalance);
    await insertUserInGroup(1, "yellow");
    await insertUser('Taylor', birthday, age, false, accountBalance);
    await insertUserInGroup(2, "green");
    await insertUser('Adam', birthday, age, isActive, accountBalance);
    await insertUserInGroup(3, "green");

    // prepare momento model cache client
    const momentoClient = MomentoClientGenerator.getInstance({
        configuration: Configurations.Laptop.latest(),
        credentialProvider: CredentialProvider.fromEnvironmentVariable({environmentVariableName: 'MOMENTO_API_KEY'}),
        defaultTtlSeconds: 60,
        modelCacheName: "my-model-cache",
        forceCreateCache: true
    });

    const log = LoggerFactory.createLogger({ logLevel: 'debug' })
    const momentoSequelizeClient = await modelCacheFactory(momentoClient, {
        logger: log, compressionType: CompressionType.ZLIB
    });

    const userFindPKRaw = await momentoSequelizeClient.wrap(User).findByPk(1);
    log.debug({details: userFindPKRaw.username}, "Found user with name: ");


    const userFindPKAliased = await momentoSequelizeClient.wrap(User).findByPk(2, {
        attributes: [
            // aliasing
            [Sequelize.col('username'), 'uName'],
        ],
        plain: true
    });

    log.debug({details: userFindPKAliased.uName}, "Found user with name: ");


    if (userFindPKAliased) {
        try {
            await userFindPKAliased.save();
        } catch (error) {
            if (error instanceof TypeError) {
                log.debug({message: error.message}, 'Expected TypeError');
            } else {
                throw error;
            }
        }
    }

    const UserFindOneInGroup = await momentoSequelizeClient.wrap(UserGroup).findOne({
        include: [
            {
                required: true,
                attributes: [],
                model: User,
                where: {
                    id: 1
                }
            }
        ]
    });

    log.debug({user: UserFindOneInGroup.UserId, group: UserFindOneInGroup.group}, "Found user with group: ");

    const UserFindAllSorted = await momentoSequelizeClient.wrap(User).findAll({ order: [
        ['username', 'DESC'],
    ],});

    log.debug({ user1: UserFindAllSorted[0].username, user2: UserFindAllSorted[1].username,
        user3: UserFindAllSorted[2].username}, "Found users sorted desc: ");

    const UserFindAllGroupedCount = await momentoSequelizeClient.wrap(User).findAll({
        attributes: ['isActive', [sequelize.fn('COUNT', sequelize.col('id')), 'userCount']],
        group: ['isActive'],
        raw: true

    });

    // @ts-ignore
    log.debug({ state1: `isActive:${UserFindAllGroupedCount[0].isActive},count:${UserFindAllGroupedCount[0].userCount}`,
        state2: `isActive:${UserFindAllGroupedCount[1].isActive},count:${UserFindAllGroupedCount[1].userCount}`},
        "Found users grouped by `isActive` with counts: ");
}

doWork().catch(console.error);
