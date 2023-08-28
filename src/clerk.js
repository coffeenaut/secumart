/** Clerk worker focuses administration of application data**/
const fs = require('fs');
const mapFileName = process.env.app_map_file
const appDataFileName = process.env.app_data_file
const stackupPath = process.env.stackup_app_filePath
const appDataPath = process.env.app_data_path

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
    filename: `logs/maulog.clerk-${new Date().toISOString().split('T')[0]}.log`,
  })],
});

function isAuthorizedAdmin(adminToken) {
    return (adminToken === process.env.admin_secret_token)
}
function getAppData(applicationId) {
    let appList = require(`..${appDataPath}/${appDataFileName}`);
    let result = appList.filter(function(item){
            return item.applicationID === applicationId;
    });
    if(result)
        return result;
    else
        return null;
}
async function restoreAppData(appFileName) {
    //remove data files
    try {
        await deleteFile(`.${appDataPath}/${appFileName}`)
    }
    catch(error) {
        logger.error(`error deleting ${appFileName}; ${err}`)
        return false
    }
    //copy stackup (static+backup) file to dataPath 
    try{
        await copyFile(appFileName, stackupPath, appDataPath)
        return true
    }
    catch(err) { 
        logger.error(`Error copying ${appFileName} to ${appDataPath}`) 
        return false
    }
 }
async function copyFile(filename, sourcePath, destinationPath) {
    fs.copyFile(`.${sourcePath}/${filename}`, `.${destinationPath}/${filename}`, (err) => {
        if (err) {
            logger.error(`Error copying file ${filename} to ${destinationPath}; ${err}`)
        }
        //otherwise success
        logger.info(`${filename} copied to ${destinationPath} successfully.`)
      });
}
async function deleteFile(filepath) {
    fs.unlink(filepath,function(err){
        if(err) {
            logger.error(`Error delete file at ${filepath}; ${err}`)
        }
        logger.info(`Deleted file at ${filepath}`)
   });  
}
//this function will rewrite the app settings file to the new settings.
async function updateAppSettings(updatedSettings) {
    let appfilepath = `.${appDataPath}/${appDataFileName}`
    let isOperationSuccess = false
    logger.info("Overrriding app settings")
    fs.writeFile(appfilepath, JSON.stringify(updatedSettings, null, 2), function(error) {
        if(error)
            logger.error(error)
        else
        isOperationSuccess = true
    })
    logger.info("App settings updated successfully")
    return isOperationSuccess
}
module.exports = {getAppData, isAuthorizedAdmin, restoreAppData, updateAppSettings}