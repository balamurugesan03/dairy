const fs = require("fs");

const PRINTER_PORT = "\\\\.\\USB001";

try {

  const fd = fs.openSync(PRINTER_PORT, "w");

  const text = "\n\nTEST PRINT\nDAIRY SOCIETY\n\n\n";

  fs.writeSync(fd, text);

  fs.closeSync(fd);

  console.log("Print sent successfully");

} catch (err) {

  console.error("Printer error:", err);

}