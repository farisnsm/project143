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
        if (error) { console.log(error) } else { console.log(moment().add(8,'hours').format()) }
    })
    setTimeout(cancelTimeout, 1000 * 60 * 60);
}
let nodeChats = []
function getNodeChats() {
    connection.query('select * from nodes', function (error, results, fields) {
        if (error) { console.log(error) } else {
            nodeChats = JSON.parse(JSON.stringify(results))
            console.log(nodeChats)
        }
    })
}
getNodeChats()
function checkParadeState(psID, chatID, nodeID) {
    connection.query('SELECT * from psa_details where PS_ID = ' + psID + ' and (NODE_ID = ' + nodeID + ' or 0 = ' + nodeID + ')', function (error, results, fields) {
        if (error) { console.log(error) } else {
            if (results.length == 0) {
                bot.sendMessage(chatID, "No results yet")
            } else {
                connection.query('SELECT * from users_details where (NODE_ID = ' + nodeID + ') and TELEGRAM_ID not in (select PS_BY_ID from psa_details where PS_ID = ' + psID + ' and NODE_ID = ' + nodeID + ')', function (error, users, fields) {
                    if (error) { console.log(error) }
                    //console.log(users)
                    let response = "Parade State Summary"
                    response = response + "\nNode: " + results[0].NODE_NAME
                    response = response + "\nStart Time: " + moment(results[0].PS_START).format(userFriendlyTS)
                    response = response + "\nEnd Time: " + moment(results[0].PS_END).format(userFriendlyTS)
                    response = response + "\n\n"
                    let statusTally = [...new Set(results.map(r => r.PS_OPTION + ": " + results.filter(rr => rr.PS_OPTION == r.PS_OPTION).length))]
                    response = response + statusTally.join("\n")
                    response = response + "\nNo Response: " + users.length
                    let branchTally = [...new Set(results.map(r => r.BRANCH_NAME + ": " + results.filter(rr => rr.BRANCH_NAME == r.BRANCH_NAME).length + "/" + r.COUNT + "\n" + results.filter(rr => rr.BRANCH_NAME == r.BRANCH_NAME).sort((a,b) => (b.PS_OPTION == "Present") - (a.PS_OPTION=="Present")).map(rr => rr.PS_RANK + " " + rr.PS_NAME + " - " + rr.PS_OPTION).join("\n") + "\n" + users.filter(rr => rr.BRANCH_NAME == r.BRANCH_NAME).map(rr => rr.RANK + " " + rr.NAME + " - NO RESPONSE").join("\n") + "\n"))]
                    response = response + "\n\n"
                    response = response + branchTally.join("\n")
                    let unresponded = users.filter(u => results.map(r => r.BRANCH_NAME).indexOf(u.BRANCH_NAME) == -1)
                    //console.log(unresponded)
                    let unrespondedTally = [...new Set(unresponded.map(r => r.BRANCH_NAME + ": " + "0/" + unresponded.filter(rr => rr.BRANCH_NAME == r.BRANCH_NAME).length + "\n" + unresponded.filter(rr => rr.BRANCH_NAME == r.BRANCH_NAME).map(rr => rr.RANK + " " + rr.NAME + " - NO RESPONSE").join("\n")))]
                    response = response + "\n"
                    response = response + unrespondedTally.join("\n")
                    bot.sendMessage(chatID, response)
                })

            }
        }
    })
}
cancelTimeout()
let createNode = false
let createStatus = false
let editStatus = 0
let createStatusQn = 0
let nodeOTP = 0
let newNodeID = 0
let newNodeName = ''
let createBranch = 0
let rnID = 0
let psQn = []
let adminChat = '-921229488'
let statuses = []
let eui = 0
let renameNode = 0
let renameBranch = 0
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
                                    connection.query('select * from nodes', function (error, results, fields) {
                                        if (error) { console.log(error) } else {
                                            let branches = []
                                            results.forEach(b => {
                                                branches.push([{ text: b.NODE_NAME, callback_data: 'AR_' + b.ID + "_" + chatId }])
                                            })
                                            branches.push([{ text: "Reject", callback_data: 'RR_' + chatId }])
                                            var options = {
                                                reply_markup: JSON.stringify({
                                                    inline_keyboard: branches
                                                })
                                            };
                                            bot.sendMessage(adminChat, "New user registration\n\nName:" + message.split("Name:")[1] + "\n\n To approve, select a node to assign to", options)
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
                    if (user.ACTIVE == 0 || user.ORD < moment().add(8,'hours').format("YYYYMMDD")) {
                        bot.sendMessage(chatId, "You are not authorized to use this bot")
                    } else {
                        if (psQn.indexOf(chatId) != -1) {
                            psQn.splice(psQn.indexOf(chatId), 1)
                            connection.query('update parade_state_attendance set PS_REMARKS = "' + message + '" where ID = (Select ID from (SELECT ID FROM parade_state_attendance where PS_BY_ID = "' + chatId + '" order by ID desc limit 1) psa)', function (error, results, fields) {
                                if (error) { console.log(error) } else {
                                    bot.sendMessage(chatId, "Parade state status follow up question succesfully captured")
                                }
                            })
                        }
                        if (message == '/editMyInfo') {
                            bot.sendMessage(chatId, "Please copy, paste and update this message to update your info\nORD Date must be in the format YYYYMMDD\n\nName: " + user.NAME + "\nRank: " + user.RANK + "\nORD Date: " + user.ORD)
                        }
                        if (message.indexOf("Name:") != -1) {
                            let userName = message.split("Name:")[1].split("\n")[0].trim()
                            let userRank = message.split("Rank:")[1].split("\n")[0].trim()
                            let userORD = message.split("ORD Date:")[1].split("\n")[0].trim()
                            connection.query('update users set NAME = "' + userName + '", RANK = "' + userRank + '", ORD = "' + userORD + '" where ID = ' + user.ID, function (error, results, fields) {
                                if (error) { console.log(error) } else {
                                    bot.sendMessage(chatId, "Info update succesful\nType or tap /editMyInfo to update your information")
                                }
                            })
                        }
                    }
                }
            }
        })
    } else if (msg.chat.id != adminChat) {
        let nodeChat = nodeChats.filter(n => n.NODE_CHAT_ID == msg.chat.id || msg.chat.id == n.NODE_CHAT_ID.split('-').join('-100'))
        if (nodeChat.length == 0) {
            if (nodeOTP == message.trim() && nodeOTP != 0) {
                //OTP recognized
                connection.query("update nodes set NODE_CHAT_ID = '" + msg.chat.id + "' where ID = " + newNodeID, function (error, results, fields) {
                    if (error) { console.log(error) } else {
                        bot.sendMessage(msg.chat.id, "Set up complete. This chat is now the Duty Personnel Group Chat for " + newNodeName + '\n\nTap or type /start or /info to bring up the menu')
                        createNode = false
                        nodeOTP = 0
                        newNodeID = 0
                        newNodeName = ''
                        getNodeChats()
                    }
                })
            } else {
                console.log(msg)
                bot.sendMessage(msg.chat.id, "This group chat has not been verified. Please obtain an OTP from the Bot Administrator to set up this group chat")
            }
        } else {
            nodeChat = nodeChat[0]
            if (message == '/start' || message == '/info') {
                bot.sendMessage(msg.chat.id, "This is the duty personnel chat for " + nodeChat.NODE_NAME + "\n\nTo start parade state, key in \n\nStart parade state <DURATION(MINUTES)>\n\nThis will start a parade state that will end in the specified duration \ni.e. 'Start parade state 30' will start a parade state that will last 30mins\nIf no duration is provided (or invalide duration), the parade state will default to 15mins\nUsers will not be able to respond to a parade state after the time expires\n\nTap or type /viewusers to view all the users in this node")
            }

            if (nodeOTP == message.trim() && nodeOTP != 0) {
                //OTP recognized
                connection.query("update nodes set NODE_CHAT_ID = '" + msg.chat.id + "' where ID = " + newNodeID, function (error, results, fields) {
                    if (error) { console.log(error) } else {
                        bot.sendMessage(msg.chat.id, "Set up complete. This chat is now the Duty Personnel Group Chat for " + nodeChat.NODE_NAME + '\n\nTap or type /start or /info to bring up the menu')
                        createNode = false
                        nodeOTP = 0
                        newNodeID = 0
                        newNodeName = ''
                        getNodeChats()
                    }
                })
            }

            if (message.toLowerCase().indexOf("start parade state") == 0) {
                let msgFromName = msg.from.first_name
                let msgFromId = msg.from.id
                if (message.toLowerCase().trim() == "start parade state") {
                    message = "start parade state x"
                }
                let duration = message.split("state")[1].trim()
                if (isNaN(duration)) {
                    duration = 15
                    bot.sendMessage(nodeChat.NODE_CHAT_ID, "Parade state duration invalid. Parade state default to 15mins")
                }
                let startTS = moment().add(8,'hours').format()
                let endTS = moment().add(8,'hours').add(duration, 'minutes').format()
                connection.query('select * from parade_state where NODE_ID = ' + nodeChat.ID + ' and PS_END >= "' + startTS + '"', function (error, results, fields) {
                    if (error) { console.log(error) } else {
                        if (results.length == 0) {
                            connection.query('insert into parade_state (PS_START,PS_END,PS_BY_NAME,PS_BY_ID,NODE_ID) values("' + startTS + '","' + endTS + '","' + msgFromName + '","' + msgFromId + '",' + nodeChat.ID + ')', function (error, results, fields) {
                                if (error) { console.log(error) } else {
                                    let psID = results.insertId
                                    connection.query('select * from users where NODE_ID = ' + nodeChat.ID + ' and active = 1 and ord >= ' + moment().add(8,'hours').format("YYYYMMDD"), function (error, users, fields) {
                                        if (error) { console.log(error) } else {
                                            connection.query('select * from statuses', function (error, results, fields) {
                                                statuses = JSON.parse(JSON.stringify(results))
                                                let opts = results.map(r => [{ text: r.STATUS, callback_data: 'PS_' + r.STATUS + '_' + psID + "_" + moment(endTS).format() + "_" + r.ID }])
                                                var options = {
                                                    reply_markup: JSON.stringify({
                                                        inline_keyboard: opts
                                                    })
                                                };
                                                users.forEach(r => {
                                                    bot.sendMessage(r.TELEGRAM_ID, "Parade state has started and will end in " + duration + " minutes", options)
                                                })
                                                bot.sendMessage(nodeChat.NODE_CHAT_ID, "Parade state started and will end @ " + moment(endTS).format(userFriendlyTS) + "\nYou can type or tap /checkParadeState" + psID + " to check on the status of this parade state")
                                                bot.sendMessage(adminChat, "Parade started for " + nodeChat.NODE_NAME + " and will end @ " + moment(endTS).format(userFriendlyTS) + "\nYou can type or tap /checkParadeState" + psID + " to check on the status of this parade state")

                                            })

                                        }
                                    })
                                }
                            })
                        } else {
                            bot.sendMessage(nodeChat.NODE_CHAT_ID, "There is already a parade state on going right now. Type or Tap /checkParadeState" + results[0].ID + " to check its status")
                        }
                    }
                })

            }
            if (message.toLowerCase().indexOf("/checkparadestate") == 0) {
                let psID = message.toLowerCase().split("state")[1].split("@")[0].trim()
                checkParadeState(psID, msg.chat.id, nodeChat.ID)
            }
            if (message == '/viewusers' || message == '/viewusers@project143_bot') {
                connection.query("select * from users_details where NODE_ID = '" + nodeChat.ID + "'", function (error, results, fields) {
                    if (error) { console.log(error) } else {
                        bot.sendMessage(nodeChat.NODE_CHAT_ID, "Viewing users in " + nodeChat.NODE_NAME + "\n\n" + results.map(r => r.RANK + " " + r.NAME + " (" + r.BRANCH_NAME + ")").join('\n'))
                    }
                })
            }
        }
    }
    if (msg.chat.id == adminChat) {
        if (message.toLowerCase() == '/start') {
            var options = {
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [{ text: "Manage Nodes", callback_data: 'managenodes' }],
                        [{ text: "Manage Statuses", callback_data: 'managestatus' }],
                        [{ text: "Manage Users", callback_data: 'manageusers' }],
                        [{ text: "Cancel", callback_data: 'x' }]
                    ]
                })
            };
            bot.sendMessage(adminChat, "Please select what you would like to do", options)
        }
        if (createBranch != 0) {
            connection.query("insert into branches (node_id,branch_name) values (" + createBranch + ",'" + message + "')", function (error, results, fields) {
                if (error) { console.log(error) } else {
                    bot.sendMessage(adminChat, "Branch succesfully created")
                    createBranch = 0
                }
            })
        }
        // if (message.toLowerCase().indexOf("start parade state") == 0) {
        //     if (message.toLowerCase().trim() == "start parade state") {
        //         message = "start parade state x"
        //     }
        //     let duration = message.split("state")[1].trim()
        //     if (isNaN(duration)) {
        //         duration = 15
        //         bot.sendMessage(adminChat, "Parade state duration invalid. Parade state default to 15mins")
        //     }
        //     let startTS = moment().add(8,'hours').format()
        //     let endTS = moment().add(8,'hours').add(duration, 'minutes').format()
        //     console.log(startTS)
        //     console.log(endTS)
        //     connection.query('select * from parade_state where PS_END >= "' + startTS + '"', function (error, results, fields) {
        //         if (error) { console.log(error) } else {
        //             if (results.length == 0) {
        //                 connection.query('insert into parade_state (PS_START,PS_END,PS_BY_NAME,PS_BY_ID) values("' + startTS + '","' + endTS + '","' + msgFromName + '","' + msgFromId + '")', function (error, results, fields) {
        //                     if (error) { console.log(error) } else {
        //                         let psID = results.insertId
        //                         connection.query('select * from users where active = 1 and ord >= ' + moment().add(8,'hours').format("YYYYMMDD"), function (error, results, fields) {
        //                             if (error) { console.log(error) } else {
        //                                 var options = {
        //                                     reply_markup: JSON.stringify({
        //                                         inline_keyboard: [
        //                                             [{ text: "Present", callback_data: 'PS_Present_' + psID + "_" + moment(endTS).format() }],
        //                                             [{ text: "Absent", callback_data: 'PS_Absent_' + psID + "_" + moment(endTS).format() }]
        //                                         ]
        //                                     })
        //                                 };
        //                                 results.forEach(r => {
        //                                     bot.sendMessage(r.TELEGRAM_ID, "Parade state has started and will end in " + duration + " minutes", options)
        //                                 })
        //                                 bot.sendMessage(adminChat, "Parade state started and will end @ " + moment(endTS).format(userFriendlyTS) + "\nYou can type or tap /checkParadeState" + psID + " to check on the status of this parade state")
        //                             }
        //                         })
        //                     }
        //                 })
        //             } else {
        //                 bot.sendMessage(adminChat, "There is already a parade state on going right now. Type or Tap /checkParadeState" + results[0].ID + " to check its status")
        //             }
        //         }
        //     })

        // }
        if (message.toLowerCase().indexOf("/checkparadestate") == 0) {
            let psID = message.toLowerCase().split("state")[1].split("@")[0].trim()
            checkParadeState(psID, adminChat, 0)
        }
        if (createNode == true) {
            connection.query("insert into nodes (node_name) values ('" + message + "')", function (error, results, fields) {
                if (error) { console.log(error) } else {
                    newNodeID = results.insertId
                    nodeOTP = Math.floor(Math.random() * (9999 - 1000) + 1000)
                    newNodeName = message
                    bot.sendMessage(adminChat, "New node created. Please follow the following steps to complete set up\n\n1) Create a new group chat\n2) Add this bot into that group chat\n3) Copy and paste this OTP into that chat => " + nodeOTP)
                    createNode = false
                }
            })
        }

        if (createStatus == true) {
            createStatus = false
            connection.query('insert into statuses (STATUS) values ("' + message + '")', function (error, results, fields) {
                if (error) { console.log(error) } else {
                    var options = {
                        reply_markup: JSON.stringify({
                            inline_keyboard: [
                                [{ text: "Yes", callback_data: "fuqn_" + results.insertId }],
                                [{ text: "No", callback_data: "cnsx" }]
                            ]
                        })
                    };
                    bot.sendMessage(adminChat, "Does this status require a follow up question?\ni.e. Please key in the end date of your MC", options)
                }
            })
        }
        if (createStatusQn != 0) {
            let sID = createStatusQn
            createStatusQn = 0
            connection.query('update statuses set FOLLOW_UP = "' + message + '" where ID = ' + sID, function (error, results, fields) {
                if (error) { console.log(error) } else {
                    bot.sendMessage(adminChat, "Status update/creation successfull")
                }
            })
        }
        if (editStatus != 0) {
            let sID = editStatus
            editStatus = 0
            connection.query('update statuses set STATUS = "' + message + '" where ID = ' + sID, function (error, results, fields) {
                if (error) { console.log(error) } else {
                    bot.sendMessage(adminChat, "Status update successfull")
                }
            })
        }
        if (eui != 0) {
            let userID = eui
            eui = 0
            let userName = message.split("Name:")[1].split("\n")[0].trim()
            let userRank = message.split("Rank:")[1].split("\n")[0].trim()
            let userORD = message.split("ORD Date:")[1].split("\n")[0].trim()
            connection.query('update users set NAME = "' + userName + '", RANK = "' + userRank + '", ORD = "' + userORD + '" where ID = ' + userID, function (error, results, fields) {
                if (error) { console.log(error); bot.sendMessage(adminChat, "ERROR\nInfo update unsuccesful") } else {
                    bot.sendMessage(adminChat, "Info update succesful")

                }
            })
        }

        if (renameNode != 0) {
            let sID = renameNode
            renameNode = 0
            connection.query('update nodes set node_name = "' + message + '" where ID = ' + sID, function (error, results, fields) {
                if (error) { console.log(error) } else {
                    bot.sendMessage(adminChat, "Node rename successfull")
                    getNodeChats()
                }
            })
        }
        if (renameBranch != 0) {
            let sID = renameBranch
            renameBranch = 0
            connection.query('update branches set branch_name = "' + message + '" where ID = ' + sID, function (error, results, fields) {
                if (error) { console.log(error) } else {
                    bot.sendMessage(adminChat, "Branch rename successfull")
                }
            })
        }
    }
})

bot.on('callback_query', function onCallbackQuery(callbackQuery) {
    const actions = callbackQuery.data.split('_');
    const msg = callbackQuery.message.text;
    let responder = callbackQuery.from.id
    let path = actions[0]
    if (path == 'x') {
        bot.sendMessage(callbackQuery.message.chat.id, "Input cancelled")
    }
    if (actions[0] == "AR") {
        connection.query('select * from branches where NODE_ID = ' + actions[1], function (error, results, fields) {
            if (error) { console.log(error) } else {
                let branches = []
                results.forEach(b => {
                    branches.push([{ text: b.BRANCH_NAME, callback_data: 'AR2_' + actions[1] + "_" + actions[2] + "_" + b.ID }])
                })
                var options = {
                    reply_markup: JSON.stringify({
                        inline_keyboard: branches
                    })
                };
                bot.sendMessage(adminChat, "New user registration\n\nName:" + msg.split("Name:")[1].split("To approve")[0] + "To approve, select a branch to assign to", options)
            }
        })

    }

    if (path == 'AR2') {
        connection.query('Update users set ACTIVE = 1, BRANCH_ID = ' + actions[3] + ', NODE_ID = ' + actions[1] + ' where TELEGRAM_ID = "' + actions[2] + '"', function (error, results, fields) {
            if (error) { console.log(error) } else {
                bot.sendMessage(actions[2], "Your registration has been approved\nType or tap /editMyInfo to update your information")
                bot.sendMessage(adminChat, "Registration approved for " + msg.split("Name:")[1].split("\n")[0].trim())
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
    if (actions[0] == "PS") {
        if (moment().add(8,'hours').format() <= moment(actions[3]).format()) {
            let user = {}
            connection.query('select * from users where TELEGRAM_ID = "' + responder + '"', function (error, results, fields) {
                if (error) { console.log(error) } else {
                    user = results[0]
                    let status = statuses.filter(s => s.ID == actions[4])[0]
                    if (status.FOLLOW_UP == null) {
                        connection.query('insert into parade_state_attendance (PS_ID,PS_TS,PS_NAME,PS_RANK,PS_BY_ID,PS_OPTION) values ("' + actions[2] + '","' + moment().add(8,'hours').format() + '","' + user.NAME + '","' + user.RANK + '","' + user.TELEGRAM_ID + '","' + actions[1] + '")', function (error, results, fields) {
                            if (error) { console.log(error) } else {
                                bot.sendMessage(responder, "Response succesfully captured: " + actions[1])
                            }
                        })

                    } else {
                        connection.query('insert into parade_state_attendance (PS_ID,PS_TS,PS_NAME,PS_RANK,PS_BY_ID,PS_OPTION,PS_REMARKS) values ("' + actions[2] + '","' + moment().add(8,'hours').format() + '","' + user.NAME + '","' + user.RANK + '","' + user.TELEGRAM_ID + '","' + actions[1] + '","Yet to answer follow up question")', function (error, results, fields) {
                            if (error) { console.log(error) } else {
                                bot.sendMessage(responder, "Status selected: " + actions[1] + "\nPlease answer the follow up question below\nYour status is not updated until you answer the follow up question\n\n" + status.FOLLOW_UP)
                                psQn.push(responder)
                            }
                        })

                    }


                }
            })

        } else {
            bot.sendMessage(responder, "Unsucessful, the parade state ended at " + moment(actions[3]).format(userFriendlyTS))
        }
    }
    if (path == 'managenodes') {
        let opts = []
        nodeChats.forEach(n => {
            opts.push([{ text: n.NODE_NAME, callback_data: 'mn_' + n.ID + '_' + n.NODE_NAME }])
        })
        opts.push([{ text: "Create New Node", callback_data: 'createnode' }])
        opts.push([{ text: "Cancel", callback_data: 'x' }])
        var options = {
            reply_markup: JSON.stringify({
                inline_keyboard: opts
            })
        };
        bot.sendMessage(adminChat, "Manage Node Selected\n\nPlease select a node or create a new one", options)
    }
    if (path == 'mn') {
        var options = {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [{ text: "Rename node", callback_data: 'rn_' + actions[1] + "_" + actions[2] }],
                    [{ text: "Request group chat OTP", callback_data: 'cgc_' + actions[1] }],
                    [{ text: "Manage branches", callback_data: 'mb_' + actions[1] + "_" + actions[2] }],
                    [{ text: "Cancel", callback_data: 'x' }]
                ]
            })
        };
        bot.sendMessage(adminChat, "Node Selected: " + actions[2] + "\n\nPlease select an action", options)
    }

    if (path == 'cgc') {
        newNodeID = actions[1]
        nodeOTP = Math.floor(Math.random() * (9999 - 1000) + 1000)
        bot.sendMessage(adminChat, "Send this OTP to a group chat the bot is in to make that chat the Duty Personnel chat for " + nodeChats.filter(r => r.ID == actions[1])[0].NODE_NAME + " => " + nodeOTP)
    }

    if (path == 'rn') {
        bot.sendMessage(adminChat, "Rename Node selected\nPlease key in the new name for " + actions[2])
        renameNode = actions[1]
    }

    if (path == 'rb') {
        bot.sendMessage(adminChat, "Rename Branch selected\nPlease key in the new name for " + actions[2])
        renameBranch = actions[1]
    }

    if (path == 'manageusers') {
        let opts = []
        nodeChats.forEach(n => {
            opts.push([{ text: n.NODE_NAME, callback_data: 'mu_' + n.ID + '_' + n.NODE_NAME }])
        })
        opts.push([{ text: "Cancel", callback_data: 'x' }])
        var options = {
            reply_markup: JSON.stringify({
                inline_keyboard: opts
            })
        };
        bot.sendMessage(adminChat, "Manage Users Selected\n\nPlease select which node the user belongs to", options)
    }

    if (path == 'mu') {
        connection.query('select * from users_details where NODE_ID = ' + actions[1], function (error, results, fields) {
            if (error) { console.log(error) } else {
                let opts = []
                results.forEach(u => {
                    opts.push([{ text: u.RANK + " " + u.NAME + " (" + u.BRANCH_NAME + ")", callback_data: 'mu1_' + u.ID }])
                })
                opts.push([{ text: "Cancel", callback_data: 'x' }])
                var options = {
                    reply_markup: JSON.stringify({
                        inline_keyboard: opts
                    })
                };
                bot.sendMessage(adminChat, "Node Selected: " + actions[2] + "\n\nPlease select a user", options)
            }
        })
    }

    if (path == 'mu1') {
        connection.query('select * from users_details where ID = ' + actions[1], function (error, results, fields) {
            if (error) { console.log(error) } else {
                let user = results[0]
                var options = {
                    reply_markup: JSON.stringify({
                        inline_keyboard: [
                            [{ text: "Edit user Name, Rank or ORD", callback_data: "eui_" + actions[1] }],
                            [{ text: "Assign user to a different node/branch", callback_data: "mu2_" + actions[1] }],
                            [{ text: "Cancel", callback_data: 'x' }]
                        ]
                    })
                };
                bot.sendMessage(adminChat, "Selected User:\nName: " + user.NAME + "\nRank: " + user.RANK + "\nORD Date: " + user.ORD + "\nNode: " + user.NODE_NAME + "\nBranch: " + user.BRANCH_NAME + "\n\nPlease select an option", options)
            }
        })
    }

    if (path == 'eui') {
        connection.query('select * from users_details where ID = ' + actions[1], function (error, results, fields) {
            if (error) { console.log(error) } else {
                eui = actions[1]
                let user = results[0]
                bot.sendMessage(adminChat, "Editing user info\nPlease copy, paste and edit this message and send it back to this chat\nORD Date must be in this format: YYYYMMDD\n\nName: " + user.NAME + "\nRank: " + user.RANK + "\nORD Date: " + user.ORD)
            }
        })
    }

    if (path == 'mu2') {
        connection.query('select * from users_details where ID = ' + actions[1], function (error, results, fields) {
            let user = results[0]
            let opts = []
            nodeChats.forEach(n => {
                opts.push([{ text: n.NODE_NAME, callback_data: 'mu3_' + n.ID + "_" + n.NODE_NAME + "_" + actions[1] }])
            })
            opts.push([{ text: "Cancel", callback_data: 'x' }])
            var options = {
                reply_markup: JSON.stringify({
                    inline_keyboard: opts
                })
            };
            bot.sendMessage(adminChat, "Please select which Node is " + user.RANK + " " + user.NAME + " in", options)
        })
    }
    if (path == 'mu3') {
        connection.query('select * from branches where NODE_ID = ' + actions[1], function (error, results, fields) {
            let opts = []
            results.forEach(b => {
                opts.push([{ text: b.BRANCH_NAME, callback_data: 'mu4_' + actions[1] + "_" + b.ID + "_" + b.BRANCH_NAME + "_" + actions[3] }])
            })
            opts.push([{ text: "Cancel", callback_data: 'x' }])
            var options = {
                reply_markup: JSON.stringify({
                    inline_keyboard: opts
                })
            };
            bot.sendMessage(adminChat, msg.split("which Node").join('which Branch') + '\nNode selected: ' + actions[2], options)
        })
    }

    if (path == 'mu4') {
        let branchID = actions[2]
        let nodeID = actions[1]
        let userID = actions[4]
        let rankName = msg.split(" is ")[1].split(" in\n")[0]
        connection.query('update users set BRANCH_ID = ' + branchID + ', NODE_ID = ' + nodeID + ' where ID = ' + userID, function (error, results, fields) {
            if (error) { console.log(error) }
            bot.sendMessage(adminChat, rankName + " has been assigned to " + msg.split("Node selected: ")[1] + ", " + actions[3])
        })

    }
    if (path == 'mb') {
        connection.query('select * from branches where NODE_ID = ' + actions[1], function (error, results, fields) {
            if (error) { console.log(error) } else {
                let opts = []
                results.forEach(b => {
                    opts.push([{ text: b.BRANCH_NAME, callback_data: 'rb_' + b.ID + '_' + b.BRANCH_NAME }])
                })
                opts.push([{ text: "Create New Branch", callback_data: 'cb_' + actions[1] + "_" + actions[2] }])
                opts.push([{ text: "Cancel", callback_data: 'x' }])
                var options = {
                    reply_markup: JSON.stringify({
                        inline_keyboard: opts
                    })
                };
                bot.sendMessage(adminChat, "Node Selected: " + actions[2] + "\n\nYou can either create a new branch or rename an existing branch. Select a branch to rename it", options)
            }
        })
    }

    if (path == 'cb') {
        createBranch = actions[1]
        bot.sendMessage(adminChat, "Creating new branch for " + actions[2] + "\nPlease key in the name of the new branch")
    }

    if (path == 'createnode') {
        bot.sendMessage(adminChat, "Please key in the name of the Node")
        createNode = true
    }

    if (path == 'managestatus') {
        let opts = []
        connection.query('select * from statuses', function (error, results, fields) {
            if (error) { console.log(error) } else {
                opts = results.map(r => [{ text: r.STATUS, callback_data: "ms_" + r.ID }])
                opts.push([{ text: "Create new status", callback_data: "cns" }])
                opts.push([{ text: "Cancel", callback_data: 'x' }])
                var options = {
                    reply_markup: JSON.stringify({
                        inline_keyboard: opts
                    })
                };
                bot.sendMessage(adminChat, "Please select either an existing status or create a new one", options)
            }
        })
    }

    if (path == 'cns') {
        createStatus = true
        bot.sendMessage(adminChat, "Please key in the Title of the Status\ni.e. Present, MC, On Leave etc...")
    }

    if (path == 'cnsx') {
        bot.sendMessage(adminChat, "New status succesfully created")
    }

    if (path == 'fuqn') {
        createStatusQn = actions[1]
        bot.sendMessage(adminChat, "Please key in the follow up question when users select this status")
    }

    if (path == 'ms') {
        connection.query('select * from statuses where ID = ' + actions[1], function (error, results, fields) {
            if (error) { console.log(error) } else {
                results = results[0]
                let qn = ""
                let opts = [
                    [{ text: "Edit status title", callback_data: "editstatus_" + actions[1] }],
                    [{ text: "Delete status", callback_data: "deletestatus_" + actions[1] }]
                ]
                if (results.FOLLOW_UP == null) {
                    opts.push([{ text: "Create follow up question", callback_data: "fuqn_" + actions[1] }]) // ok
                    qn = "No follow up question set\n"
                } else {
                    opts.push([{ text: "Edit follow up question", callback_data: "fuqn_" + actions[1] }]) // ok
                    opts.push([{ text: "Remove follow up question", callback_data: "rmqn_" + actions[1] }])
                    qn = "Follow up question: " + results.FOLLOW_UP + "\n"
                }
                opts.push([{ text: "Cancel", callback_data: 'x' }])
                var options = {
                    reply_markup: JSON.stringify({
                        inline_keyboard: opts
                    })
                };

                bot.sendMessage(adminChat, "Status selected: " + results.STATUS + "\n" + qn + "Please select an action", options)
            }
        })
    }

    if (path == "editstatus") {
        editStatus = actions[1]
        bot.sendMessage(adminChat, "Please key in the new title for the status")
    }

    if (path == "deletestatus") {
        connection.query('delete from statuses where ID = ' + actions[1], function (error, results, fields) {
            if (error) { console.log(error) } else {
                bot.sendMessage(adminChat, "Status succesfully deleted")
            }
        })
    }

    if (path == "rmqn") {
        connection.query('update statuses set FOLLOW_UP = null where ID = ' + actions[1], function (error, results, fields) {
            if (error) { console.log(error) } else {
                bot.sendMessage(adminChat, "Follow up question succesfully removed")
            }
        })
    }
    bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id)
})