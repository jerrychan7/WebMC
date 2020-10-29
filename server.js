const http = require("http"),
      fs   = require("fs"),
      url  = require("url"),
      path = require("path");
let server = http.createServer(function(request, response) {
    let pathObj = url.parse(request.url, true);
    if (pathObj.pathname === "/" || pathObj === "/index")
        pathObj.pathname = "/index.html";
    let filePath = path.join(path.resolve(), pathObj.pathname);
    let mime = ((ext = path.extname(filePath)) => {
        let t = {".png": "image/png", ".js": "application/javascript", ".css": "text/css"};
        return t[ext] || "text/html";
    })();
    fs.readFile(filePath, "binary", function(err, fileContent) {
        if (err) {
            console.log("404 " + filePath);
            response.writeHead(404, "not found");
            response.end("<h1>404 Not Found</h1>");
        } else {
            console.log("ok " + filePath);
            response.setHeader("Content-Type", mime);
            response.write(fileContent, "binary");
            response.end();
        }
    });
});
server.listen(3000);
console.log('visit http://localhost:3000');
