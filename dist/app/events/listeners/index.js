"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// app.ts imports this file once at startup so every listener below registers
// itself against the shared appEventEmitter. Add a new domain's listener
// file here when you add one.
require("./cleaning_plan.listener");
require("./additional_task.listener");
require("./shift.listener");
require("./chat.listener");
require("./location.listener");
require("./client.listener");
require("./issue_report.listener");
