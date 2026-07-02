import prisma from "../configs/prisma.js";
import { inngest } from "../inngest/index.js";

// create task
export const createTask = async (req, res) => {
    try {
        const { userId } = await req.auth();
        // support both `projectId` and `project_id` from clients
        const {
            projectId: bodyProjectId,
            project_id: body_project_id,
            title,
            description,
            type,
            status,
            priority,
            assigneeId,
            due_date,
        } = req.body;
        const projectId = bodyProjectId || body_project_id;
        const origin = req.get('origin');

        // check if user has admin role for project
        if (!projectId) {
            return res.status(400).json({ message: 'projectId is required' });
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { members: { include: { user: true } } },
        });

        if (!project) {
            return res.status(404).json({ message: 'Project not found' })
        } else if (project.team_lead !== userId) {
            return res.status(403).json({ message: 'You are not authorized to create task for this project' })
        }

        // determine assignee: prefer provided, fallback to requestor
        const taskAssigneeId = assigneeId && String(assigneeId).trim() ? assigneeId : userId;

        // treat team lead as implicit project member
        const isAssigneeMember =
            project.members.find((member) => member.userId === taskAssigneeId) ||
            project.team_lead === taskAssigneeId;

        if (!isAssigneeMember) {
            return res.status(403).json({ message: "Assignee is not a member of this project" });
        }

        if (!projectId) {
            return res.status(400).json({ message: 'projectId is required' });
        }

        const task = await prisma.task.create({
            data: {
                projectId,
                title,
                description,
                status,
                priority,
                type,
                assigneeId: taskAssigneeId,
                due_date: due_date ? new Date(due_date) : new Date(),
            },
        });

        const taskWithAssignee = await prisma.task.findUnique({
            where: { id: task.id },
            include: { assignee: true },
        });

        // respond immediately so task creation success is not blocked by inngest
        res.json({ task: taskWithAssignee, message: 'Task created successfully' });

        inngest
            .send({
                name: 'app/task.assigned',
                data: { taskId: task.id, origin },
            })
            .catch((err) => console.error('inngest send failed', err));

    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.code || error.message })
    }
}

// update task 
export const updateTask = async (req, res) => {
    try {
        const task = await prisma.task.findUnique({
            where: {
                id: req.params.id
            }
        })
        if (!task) {
            return res.status(404).json({ message: 'Task not found' })
        }
        const { userId } = await req.auth();
        // check if user has admin role for project
        const project = await prisma.project.findUnique({
            where: {
                id: task.projectId
            },
            include: {
                members: {
                    include: {
                        user: true
                    }
                }
            }
        })

        if (!project) {
            return res.status(404).json({ message: 'Project not found' })
        } else if (project.team_lead !== userId) {
            return res.status(403).json({ message: 'You are not authorized to create task for this project' })
        }

        const updatedTask = await prisma.task.update({
            where: {
                id: req.params.id
            },
            data: req.body
        })
        return res.json({ task: updatedTask, message: 'Task updated successfully' })

    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.code || error.message })
    }
}

// delete task
export const deleteTask = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { taskIds } = req.body;
        const tasks = await prisma.task.findMany({
            where: {
                id: {
                    in: taskIds
                }
            }
        })

        if (tasks.length === 0) {
            return res.status(404).json({ message: 'Tasks not found' })
        }

        const project = await prisma.project.findUnique({
            where: {
                id: tasks[0].projectId
            },
            include: {
                members: {
                    include: {
                        user: true
                    }
                }
            }
        })

        if (!project) {
            return res.status(404).json({ message: 'Project not found' })
        } else if (project.team_lead !== userId) {
            return res.status(403).json({ message: 'You are not authorized to delete task for this project' })
        }

        await prisma.task.deleteMany({
            where: {
                id: {
                    in: taskIds
                }
            }
        })

        return res.json({ message: 'Tasks deleted successfully' })

    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: error.code || error.message })
    }
}