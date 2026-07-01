import express from "express";
import { getUserWorkspaces, addMember, createWorkspace, sendInvitationEmail } from "../controllers/workspaceControllers.js";

const workspaceRouter = express.Router();

workspaceRouter.get("/", getUserWorkspaces);
workspaceRouter.post("/create", createWorkspace);
workspaceRouter.post("/add-member", addMember);
workspaceRouter.post("/send-invite-email", sendInvitationEmail);

export default workspaceRouter;