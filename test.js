let arr = [{a:1,b:"x"},{a:2,b:"y"},{a:3,b:"x"},{a:4,b:"e"}]
arr = arr.sort((a,b) => (b.b == "x") - (a.b=="x")); // b - a for reverse sort
console.log(arr)