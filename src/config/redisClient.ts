import { createClient } from 'redis';

const redisClient = createClient({
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log('Successfully connected to Redis.');
    } catch (error) {
        console.error('Could not connect to Redis:', error);
        process.exit(1);
    }
};

export { redisClient, connectRedis };