// app.ts imports this file once at startup so every listener below registers
// itself against the shared appEventEmitter. Add a new domain's listener
// file here when you add one.
import './cleaning_plan.listener';
import './additional_task.listener';
import './shift.listener';
import './chat.listener';
import './location.listener';
import './client.listener';
import './issue_report.listener';
