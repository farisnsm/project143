let arr = [{a:1,b:"x"},{a:2,b:"y"},{a:3,b:"x"},{a:4,b:"e"},{a:5,b:"y"}]
arr = arr.sort((a,b) => (a.b > b.b) ? 1 : ((b.b > a.b) ? -1 : 0)).sort((a,b) => (b.b == "x") - (a.b=="x")); // b - a for reverse sort
console.log(arr)