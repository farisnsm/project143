var moment = require('moment');
let startTS = moment().format()
console.log('select * from parade_state where PS_END >= "' + startTS + '"')