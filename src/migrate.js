/* initial data migration scripts */
const fs = require('fs');
const {parse} = require('csv-parse');
const tokenData = `./data/old/${process.env.migration_file}`;
const mapFile = `./data/old/${process.env.app_map_data_file}`;

const winston = require('winston');
const { combine, timestamp, printf, align } = winston.format;

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
    filename: `logs/maulog.migrate-${new Date().toISOString().split('T')[0]}.log`,
  })],
});

async function migrateAll() {
    //always be rewriting
    try{
    fs.writeFileSync(mapFile, "[", err => {
        if (err) {
          logger.error(`Error writing head; ${err}`)
        }
      });
    
    let firstEntry = true;
    fs.createReadStream(tokenData)
    .pipe(parse({ delimiter: ",", from_line: 2}))
    .on("data", function (row) {
        if(firstEntry) {
            addToken(row, firstEntry)
            firstEntry = false
            setTimeout(() => { }, 300)
        }
        else
            addToken(row, firstEntry)
    })
    .on("end", function () {
        //close array
        fs.appendFileSync(mapFile, "]", err => {
            if (err) {
                logger.error(`Error writing tail; ${err}`)
            }
            logger.info(`Wrote tail end`)
        });
        logger.info(`Migration success`)
      })
    .on("error", function (error) {
        logger.error(`Error occurred; ${error.message}`)
    });
    }
    catch (error) {
        logger.error(`Something dun broke; ${error}`)
    }
}
async function addToken(nToken, isInitial) {

    const lpToken = {
        url: nToken[0],
        username: nToken[1],
        password: nToken[2],
        totp: nToken[3],
        extra: nToken[4],
        domain: nToken[5],
        category: nToken[6],
        fav: nToken[7]
    }
    let token = JSON.stringify(lpToken)
    let entry = "";
    if(isInitial) //because its easier for first storage
        entry = token;
    else
        entry = ",\n" + token;
    logger.info(`wrote ${nToken[0]},${nToken[1]},${nToken[2]}`)
    fs.appendFileSync(mapFile, entry, err => {
        if (err) {
          logger.error(`Error writing for specific token ${lpToken.url}; ${err}`)
        }
      })
}

module.exports = {migrateAll}
