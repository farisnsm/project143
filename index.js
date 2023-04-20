const TelegramBot = require('node-telegram-bot-api');
const token = "5811536548:AAGaMP8LESYfVAmne6y7joPcThoV0szuFuc"
var moment = require('moment');
const bot = new TelegramBot(token, { polling: true });
var mysql = require('mysql2');
let userFriendlyTS = "dddd, DD MMM YYYY h:mm A"
let sqlCreds = "mysql://bc4d52e637516f:eeee0b9c@us-cdbr-east-06.cleardb.net/heroku_41eb19a141a06f5?reconnect=true"
var connection = mysql.createPool({
    connectionLimit: 100,
    host: sqlCreds.split('@')[1].split('/')[0],
    user: sqlCreds.split("//")[1].split(":")[0],
    password: sqlCreds.split(":")[2].split("@")[0],
    database: sqlCreds.split("/")[3].split("?")[0],
    multipleStatements: true
});
console.log(({
    connectionLimit: 100,
    host: sqlCreds.split('@')[1].split('/')[0],
    user: sqlCreds.split("//")[1].split(":")[0],
    password: sqlCreds.split(":")[2].split("@")[0],
    database: sqlCreds.split("/")[3].split("?")[0],
    multipleStatements: true
}))
function cancelTimeout() {
    connection.query('select 1', function (error, results, fields) {
        if (error) { console.log(error) } else { console.log(moment().format()) }
    })
    setTimeout(cancelTimeout, 1000 * 60 * 60);
}
cancelTimeout()
let adminChat = '-921229488'
bot.on('message', (msg) => {
    let message = msg.text
    const chatId = msg.chat.id;

    if (msg.chat.type == 'private') {

        connection.query("select * from users where TELEGRAM_ID = '" + chatId + "'", function (error, results, fields) {
            if (error) { console.log(error) } else {
                if (results.length == 0) {
                    if (message.indexOf("Name:") != -1) {
                        let userName = message.split("Name:")[1].split("\n")[0].trim()
                        let userRank = message.split("Rank:")[1].split("\n")[0].trim()
                        let userORD = message.split("ORD Date:")[1].split("\n")[0].trim()
                        if (userName.length != 0 && userRank.length != 0 && userORD != 0) {
                            connection.query("insert into users (NAME,RANK,ORD,ACTIVE,TELEGRAM_ID) values ('" + userName + "','" + userRank + "','" + userORD + "','0','" + chatId + "')", function (error, results, fields) {
                                if (error) { console.log(error) } else {
                                    bot.sendMessage(chatId, "Your registration has been sent to admin for approval")
                                    connection.query('select * from BRANCHES', function (error, results, fields) {
                                        if (error) { console.log(error) } else {
                                            let branches = []
                                            results.forEach(b => {
                                                branches.push([{ text: b.BRANCH_NAME, callback_data: 'AR_' + b.BRANCH_NAME + "_" + chatId }])
                                            })
                                            branches.push([{ text: "Reject", callback_data: 'RR_' + chatId }])
                                            var options = {
                                                reply_markup: JSON.stringify({
                                                    inline_keyboard: branches
                                                })
                                            };
                                            bot.sendMessage(adminChat, "New user registration\n\nName:" + message.split("Name:")[1] + "\n\n To approve, select a branch to assign to", options)
                                        }
                                    })
                                }
                            })
                        } else {
                            bot.sendMessage(chatId, "Invalid Input")
                        }
                    } else {
                        bot.sendMessage(chatId, "User not found\nRegistering new user\n\nPlease copy this message, update the relevant fields and send it back to this bot\n\nName: YOUR_NAME\nRank: YOUR_RANK\nORD Date: YYYYMMDD")
                    }
                } else {
                    let user = results[0]
                    console.log(user)
                    if (user.active == 0 || user.ORD < moment().format("YYYYMMDD")) {
                        bot.sendMessage(chatId,"You are not authorized to use this bot")
                    } else {
                        bot.sendMessage(chatId,"Invalid Input")
                    }
                }
            }
        })
    } else if (msg.chat.id == adminChat) {
        let msgFromName = msg.from.first_name
        let msgFromId = msg.from.id
        if (message.toLowerCase().indexOf("start parade state") == 0) {
            if(message.toLowerCase().trim() == "start parade state"){
                message = "start parade state x"
            }
            let duration = message.split("state")[1].trim()
            if (isNaN(duration)) { 
                duration = 15
                bot.sendMessage(adminChat,"Parade state duration invalid. Parade state default to 15mins")
            }
            let startTS = moment().format()
            let endTS = moment().add(duration, 'minutes').format()
            connection.query('select * from parade_state where PS_END >= "' + startTS + '"', function (error, results, fields) {
                if (error) { console.log(error) } else {
                    if(results.length == 0){
                        connection.query('insert into parade_state (PS_START,PS_END,PS_BY_NAME,PS_BY_ID) values("' + startTS + '","' + endTS + '","' + msgFromName + '","' + msgFromId + '")', function (error, results, fields) {
                            if (error) { console.log(error) } else {
                                let psID = results.insertId
                                connection.query('select * from users where active = 1 and ord >= ' + moment().format("YYYYMMDD"), function (error, results, fields) {
                                    if (error) { console.log(error) } else {
                                        var options = {
                                            reply_markup: JSON.stringify({
                                                inline_keyboard: [
                                                    [{ text: "Present", callback_data: 'PS_Present_' + psID + "_" + moment(endTS).format() }],
                                                    [{ text: "Absent", callback_data: 'PS_Absent_' + psID + "_" + moment(endTS).format()}]
                                                ]
                                            })
                                        };
                                        results.forEach(r => {
                                            bot.sendMessage(r.TELEGRAM_ID, "Parade state has started and will end in " + duration + " minutes",options)
                                        })
                                        bot.sendMessage(adminChat, "Parade state started and will end @ " + moment(endTS).format(userFriendlyTS)+"\nYou can type or tap /checkParadeState" + psID + " to check on the status of this parade state")
                                    }
                                })
                            }
                        })
                    } else {
                        bot.sendMessage(adminChat,"There is already a parade state on going right now. Type or Tap /checkParadeState" + results[0].ID + " to check its status")
                    }
                }
            })
            
        }
        if(message.toLowerCase().indexOf("/checkparadestate") == 0){
            let psID = message.toLowerCase().split("state")[1].split("@")[0].trim()
            connection.query('SELECT * from parade_state_attendance where PS_ID = ' + psID, function (error, results, fields) {
                if (error) { console.log(error) } else {
                    let summary = {}
                    let response = ""
                    results.forEach(r=>{
                        if(response.indexOf(r.PS_OPTION) == -1){
                            response = response + r.PS_OPTION + "\n" + r.PS_RANK + " " + r.PS_NAME +"\n\n"
                            summary[r.PS_OPTION] = 1
                        } else {
                            response = response.split(r.PS_OPTION).join(r.PS_OPTION + "\n" + r.PS_RANK + " " + r.PS_NAME)
                            summary[r.PS_OPTION] ++
                        }
                    })
                    
                    bot.sendMessage(adminChat,"Parade State Summary\n"+JSON.stringify(summary).split('"').join("").split("{").join("").split("}").join("").split(",").join("\n").split(":").join(": ") + "\n\n" +response)
                }
            })
        }
    } 
})

bot.on('callback_query', function onCallbackQuery(callbackQuery) {
    const actions = callbackQuery.data.split('_');
    const msg = callbackQuery.message.text;
    let responder = callbackQuery.from.id
    if (actions[0] == "AR") {
        connection.query('Update users set ACTIVE = 1, BRANCH = "' + actions[1] + '" where TELEGRAM_ID = "' + actions[2] + '"', function (error, results, fields) {
            if (error) { console.log(error) } else {
                bot.sendMessage(actions[2], "Your registration has been approved")
                bot.sendMessage(adminChat, "Reistration approved for " + msg.split("Name:")[1].split("\n")[0].trim())
            }
        })
    }
    if (actions[0] == "RR") {
        connection.query("Update users set ACTIVE = 0 where TELEGRAM_ID = '" + actions[1] + "'", function (error, results, fields) {
            if (error) { console.log(error) } else {
                bot.sendMessage(actions[1], "Your registration has been rejected. You will no longer be able to interact with this bot")
                bot.sendMessage(adminChat, "Reistration rejected for " + msg.split("Name:")[1].split("\n")[0].trim())
            }
        })
    }
    if(actions[0] == "PS"){
        if(moment().format()<=moment(actions[3]).format()){
            let user={}
            connection.query('select * from users where TELEGRAM_ID = "' + responder +'"', function (error, results, fields) {
                if (error) { console.log(error) } else {
                    user = results[0]
                    connection.query('insert into parade_state_attendance (PS_ID,PS_TS,PS_NAME,PS_RANK,PS_BY_ID,PS_OPTION) values ("'+actions[2]+'","'+moment().format()+'","'+user.NAME+'","'+user.RANK+'","'+user.TELEGRAM_ID+'","'+actions[1]+'")', function (error, results, fields) {
                        if (error) { console.log(error) } else {
                            bot.sendMessage(responder,"Response succesfully captured: " + actions[1])
                        }
                    })
                }
            }) 
            
        } else {
            bot.sendMessage(responder,"Unsucessful, the parade state ended at " + moment(actions[3]).format(userFriendlyTS))
        }
    }
    bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id)
})