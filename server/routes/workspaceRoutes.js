import express from "express";
import { getUserWorkspaces, addMember, createWorkspace } from "../controllers/workspaceControllers.js";

const workspaceRouter = express.Router();

workspaceRouter.get("/", getUserWorkspaces);
workspaceRouter.post("/create", createWorkspace);
workspaceRouter.post("/add-member", addMember);

export default workspaceRouter;