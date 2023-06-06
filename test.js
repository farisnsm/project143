let nodeChats = [
    {
        ID: 4,
        NODE_NAME: 'Sungei Gedong',
        NODE_CHAT_ID: '-1001885098462',
        DEFAULT_DURATION: 1
    },
    {
        ID: 14,
        NODE_NAME: 'THWHQ',
        NODE_CHAT_ID: '-1001896328379',
        DEFAULT_DURATION: 60
    },
    {
        ID: 94,
        NODE_NAME: 'Test',
        NODE_CHAT_ID: '',
        DEFAULT_DURATION: 15
    }
]
let chat = '-1001885098462'
let nodeChat = nodeChats.filter(n => n.NODE_CHAT_ID == chat || chat == n.NODE_CHAT_ID.split('-').join('-100'))
console.log(nodeChat)