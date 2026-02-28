export = {
    local : require("./local") as typeof import("./local"),
    remote : require("./remote") as typeof import("./remote"),
}