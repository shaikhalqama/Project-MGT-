import prisma from "../configs/prisma.js";
import sendEmail from "../configs/nodeMailer.js";

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
        let isAssigneeMember =
            project.members.find((member) => member.userId === taskAssigneeId) ||
            project.team_lead === taskAssigneeId;

        if (!isAssigneeMember) {
            // If the assignee is not a project member, check if they are a workspace member.
            const workspaceMember = await prisma.workspaceMember.findFirst({ where: { userId: taskAssigneeId, workspaceId: project.workspaceId } });
            if (workspaceMember) {
                // Auto-add the workspace member to the project members so they can be assigned tasks.
                await prisma.projectMember.create({ data: { userId: taskAssigneeId, projectId } });
                isAssigneeMember = true;
            }
        }

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
            include: { assignee: true, project: true },
        });

        // Send email notification
        try {
            await sendEmail({
                to: taskWithAssignee.assignee.email,
                subject: `New Task Assigned - ${taskWithAssignee.project.name}`,
                body: `<div style="max-width: 600px;">
        <h2>Hi ${taskWithAssignee.assignee.name}, </h2>
        <p style="font-size: 16px;">You've been assigned a new task:</p>
        <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">${taskWithAssignee.title}</p>
        <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
            <p style="margin: 6px 0;"><strong>Description:</strong> ${taskWithAssignee.description || 'No description'}</p>
            <p style="margin: 6px 0;"><strong>Due Date:</strong> ${new Date(taskWithAssignee.due_date).toLocaleDateString()}</p>
        </div>
        <a href="${origin}" style="background-color: #007bff; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; font-size: 16px; text-decoration: none;">
            View Task
        </a>
        <p style="margin-top: 20px; font-size: 14px; color: #6c757d;">
            Please make sure to review and complete it before the due date.
        </p>
    </div>`
            });
            console.log('Task assignment email sent to:', taskWithAssignee.assignee.email);
        } catch (emailError) {
            console.error('Failed to send email:', emailError);
        }

        res.json({ task: taskWithAssignee, message: 'Task created successfully' });

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

        const oldAssigneeId = task.assigneeId;
        const updatedTask = await prisma.task.update({
            where: {
                id: req.params.id
            },
            data: req.body
        })

        const taskWithDetails = await prisma.task.findUnique({
            where: { id: updatedTask.id },
            include: { assignee: true, project: true },
        });

        // Send email if assignee changed
        if (req.body.assigneeId && req.body.assigneeId !== oldAssigneeId) {
            const origin = req.get('origin');
            try {
                await sendEmail({
                    to: taskWithDetails.assignee.email,
                    subject: `Task Reassigned - ${taskWithDetails.project.name}`,
                    body: `<div style="max-width: 600px;">
        <h2>Hi ${taskWithDetails.assignee.name}, </h2>
        <p style="font-size: 16px;">You've been reassigned to this task:</p>
        <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">${taskWithDetails.title}</p>
        <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
            <p style="margin: 6px 0;"><strong>Description:</strong> ${taskWithDetails.description || 'No description'}</p>
            <p style="margin: 6px 0;"><strong>Due Date:</strong> ${new Date(taskWithDetails.due_date).toLocaleDateString()}</p>
        </div>
        <a href="${origin}" style="background-color: #007bff; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; font-size: 16px; text-decoration: none;">
            View Task
        </a>
        <p style="margin-top: 20px; font-size: 14px; color: #6c757d;">
            Please make sure to review and complete it before the due date.
        </p>
    </div>`
                });
                console.log('Task reassignment email sent to:', taskWithDetails.assignee.email);
            } catch (emailError) {
                console.error('Failed to send email:', emailError);
            }
        }

        return res.json({ task: taskWithDetails, message: 'Task updated successfully' })

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