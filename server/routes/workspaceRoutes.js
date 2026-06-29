import express from "express";
import { getUserWorkspaces, addMember } from "../controllers/workspaceControllers.js";

const workspaceRouter = express.Router();

workspaceRouter.get("/", getUserWorkspaces);
workspaceRouter.post("/add-member", addMember);

export default workspaceRouter;