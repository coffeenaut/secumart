let dotenv = require('dotenv').config()
const redis = require('redis');
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      timestamp({
        format: 'YYYY-MM-DD hh:mm:ss.SSS A',
      }),
      align(),
      printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
    ),
    transports: [new winston.transports.File({
      filename: `logs/redis-${new Date().toISOString().split('T')[0]}.log`,
    })],
  });

const redisConn = process.env.REDIS_CONNECTON_URL;
const client = () => {
    const redisClient = redis.createClient({
        url: redisConn
    });
    redisClient.on("error", err => {
        logger.error(`redis connect error: ${err}`)
    })
    return cliredisClientent
}
module.exports = {client}
