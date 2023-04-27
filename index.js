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
                bot.sendMessage(chatID,"No results yet")
            } else {
                let summary = {}
                let response = ""
                results.forEach(r => {
                    if (response.indexOf(r.PS_OPTION) == -1) {
                        response = response + r.PS_OPTION + "\n" + r.PS_RANK + " " + r.PS_NAME + "\n\n"
                        summary[r.PS_OPTION] = 1
                    } else {
                        response = response.split(r.PS_OPTION).join(r.PS_OPTION + "\n" + r.PS_RANK + " " + r.PS_NAME)
                        summary[r.PS_OPTION]++
                    }
                })

                bot.sendMessage(chatID, "Parade State Summary\nNode: " + results[0].NODE_NAME + "\n" + JSON.stringify(summary).split('"').join("").split("{").join("").split("}").join("").split(",").join("\n").split(":").join(": ") + "\n\n" + response)

            }
        }
    })
}
cancelTimeout()
let createNode = false
let nodeOTP = 0
let newNodeID = 0
let newNodeName = ''
let createBranch = 0
let rnID = 0
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
                    if (user.ACTIVE == 0 || user.ORD < moment().format("YYYYMMDD")) {
                        bot.sendMessage(chatId, "You are not authorized to use this bot")
                    } else {
                        bot.sendMessage(chatId, "Invalid Input")
                    }
                }
            }
        })
    } else if (msg.chat.id != adminChat) {
        let nodeChat = nodeChats.filter(n => n.NODE_CHAT_ID == msg.chat.id)
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
                bot.sendMessage(msg.chat.id, "This group chat has not been verified. Please obtain an OTP from the Bot Administrator to set up this group chat")
            }
        } else {
            nodeChat = nodeChat[0]
            if (message == '/start' || message == '/info') {
                bot.sendMessage(msg.chat.id, "This is the duty personnel chat for " + nodeChat.NODE_NAME + "\n\nTo start parade state, key in \n\nStart parade state <DURATION(MINUTES)>\n\nThis will start a parade state that will end in the specified duration \ni.e. 'Start parade state 30' will start a parade state that will last 30mins\nIf no duration is provided (or invalide duration), the parade state will default to 15mins\nUsers will not be able to respond to a parade state after the time expires\n\nTap or type /viewusers to view all the users in this node")
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
                let startTS = moment().format()
                let endTS = moment().add(duration, 'minutes').format()
                connection.query('select * from parade_state where NODE_ID = '+nodeChat.ID+' and PS_END >= "' + startTS + '"', function (error, results, fields) {
                    if (error) { console.log(error) } else {
                        if (results.length == 0) {
                            connection.query('insert into parade_state (PS_START,PS_END,PS_BY_NAME,PS_BY_ID,NODE_ID) values("' + startTS + '","' + endTS + '","' + msgFromName + '","' + msgFromId + '",' + nodeChat.ID + ')', function (error, results, fields) {
                                if (error) { console.log(error) } else {
                                    let psID = results.insertId
                                    connection.query('select * from users where NODE_ID = ' + nodeChat.ID + ' and active = 1 and ord >= ' + moment().format("YYYYMMDD"), function (error, results, fields) {
                                        if (error) { console.log(error) } else {
                                            var options = {
                                                reply_markup: JSON.stringify({
                                                    inline_keyboard: [
                                                        [{ text: "Present", callback_data: 'PS_Present_' + psID + "_" + moment(endTS).format() }],
                                                        [{ text: "Absent", callback_data: 'PS_Absent_' + psID + "_" + moment(endTS).format() }]
                                                    ]
                                                })
                                            };
                                            results.forEach(r => {
                                                bot.sendMessage(r.TELEGRAM_ID, "Parade state has started and will end in " + duration + " minutes", options)
                                            })
                                            bot.sendMessage(nodeChat.NODE_CHAT_ID, "Parade state started and will end @ " + moment(endTS).format(userFriendlyTS) + "\nYou can type or tap /checkParadeState" + psID + " to check on the status of this parade state")
                                            bot.sendMessage(adminChat, "Parade started for " + nodeChat.NODE_NAME + " and will end @ " + moment(endTS).format(userFriendlyTS) + "\nYou can type or tap /checkParadeState" + psID + " to check on the status of this parade state")
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
            if (message == '/viewusers') {
                //TODO
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
                        [{ text: "Manage Users", callback_data: 'manageusers' }]
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
        //     let startTS = moment().format()
        //     let endTS = moment().add(duration, 'minutes').format()
        //     console.log(startTS)
        //     console.log(endTS)
        //     connection.query('select * from parade_state where PS_END >= "' + startTS + '"', function (error, results, fields) {
        //         if (error) { console.log(error) } else {
        //             if (results.length == 0) {
        //                 connection.query('insert into parade_state (PS_START,PS_END,PS_BY_NAME,PS_BY_ID) values("' + startTS + '","' + endTS + '","' + msgFromName + '","' + msgFromId + '")', function (error, results, fields) {
        //                     if (error) { console.log(error) } else {
        //                         let psID = results.insertId
        //                         connection.query('select * from users where active = 1 and ord >= ' + moment().format("YYYYMMDD"), function (error, results, fields) {
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
    }
})

bot.on('callback_query', function onCallbackQuery(callbackQuery) {
    const actions = callbackQuery.data.split('_');
    const msg = callbackQuery.message.text;
    let responder = callbackQuery.from.id
    let path = actions[0]
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
    if (actions[0] == "PS") {
        if (moment().format() <= moment(actions[3]).format()) {
            let user = {}
            connection.query('select * from users where TELEGRAM_ID = "' + responder + '"', function (error, results, fields) {
                if (error) { console.log(error) } else {
                    user = results[0]
                    connection.query('insert into parade_state_attendance (PS_ID,PS_TS,PS_NAME,PS_RANK,PS_BY_ID,PS_OPTION) values ("' + actions[2] + '","' + moment().format() + '","' + user.NAME + '","' + user.RANK + '","' + user.TELEGRAM_ID + '","' + actions[1] + '")', function (error, results, fields) {
                        if (error) { console.log(error) } else {
                            bot.sendMessage(responder, "Response succesfully captured: " + actions[1])
                        }
                    })
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
                    // TODO [{ text: "Change group chat", callback_data: 'cgc_' + actions[1]}],
                    [{ text: "Manage branches", callback_data: 'mb_' + actions[1] + "_" + actions[2] }]
                ]
            })
        };
        bot.sendMessage(adminChat, "Node Selected: " + actions[2] + "\n\nPlease select an action", options)
    }

    //TODO
    if (path == 'rn') {
        bot.sendMessage(adminChat, "Rename Node function not ready")
    }

    //TODO
    if (path == 'rb') {
        bot.sendMessage(adminChat, "Rename Branch function not ready")
    }

    if (path == 'manageusers') {
        let opts = []
        nodeChats.forEach(n => {
            opts.push([{ text: n.NODE_NAME, callback_data: 'mu_' + n.ID + '_' + n.NODE_NAME }])
        })
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
                    opts.push([{ text: u.RANK + " " + u.NAME + " (" + u.BRANCH_NAME + ")", callback_data: 'mu2_' + u.ID }])
                })
                var options = {
                    reply_markup: JSON.stringify({
                        inline_keyboard: opts
                    })
                };
                bot.sendMessage(adminChat, "Node Selected: " + actions[2] + "\n\nYou can assign a user to a different node/branch. Please select a user", options)
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
                    opts.push([{ text: b.BRANCH_NAME, callback_data: 'rb_' + b.ID + '_' + actions[2] + "_" + b.BRANCH_NAME }])
                })
                opts.push([{ text: "Create New Branch", callback_data: 'cb_' + actions[1] + "_" + actions[2] }])
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

    if (path == 'managestatus'){
        //TODO
    }
    bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id)
})