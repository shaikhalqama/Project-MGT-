import prisma from "../configs/prisma.js";
import { inngest } from "../inngest/index.js";

// create task
export const createTask = async (req, res) => {
    try {
        const {userId} = await req.auth();
         const {projectId,title,description,type,status,priority,assigneeId,
            due_date} = req.body;
        const origin = req.get('origin')

        // check if user has admin role for project
        const project = await prisma.project.findUnique({
            where: {
                id: projectId
            },
            include: {
                members: {
                    include: {
                        user: true
                    }
                }
            }
        })
    
        if(!project) {
            return res.status(404).json({message: 'Project not found'})
        }else if(project.team_lead !== userId) {
            return res.status(403).json({message: 'You are not authorized to create task for this project'})
        }else if(assigneeId && !project.members.find(member => member.userId === assigneeId)) {
            return res.status(403).json({message: 'Assignee is not a member of this project'});
        }

        const task = await prisma.task.create({
            data: {
                project_id: projectId,
                title,
                description,
                status,
                priority,
                type,
                assigneeId,
                due_date: due_date ? new Date(due_date) : null,
                
            }
        })

        const taskWithAssignee = await prisma.task.findUnique({
            where: {
                id: task.id
            },
            include: {assignee: true}
        })

        return res.json({task:taskWithAssignee, message:'Task created successfully'})

    } catch (error) {
        console.error(error)
        return res.status(500).json({message: error.code || error.message})
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
        if(!task) {
            return res.status(404).json({message: 'Task not found'})
        }
        const {userId} = await req.auth();
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
    
        if(!project) {
            return res.status(404).json({message: 'Project not found'})
        }else if(project.team_lead !== userId) {
            return res.status(403).json({message: 'You are not authorized to create task for this project'})
        }

        const updatedTask = await prisma.task.update({
            where: {
                id: req.params.id
            },
            data: req.body
        })
        return res.json({task:updatedTask, message:'Task updated successfully'})

    } catch (error) {
        console.error(error)
        return res.status(500).json({message: error.code || error.message})
    }
}

// delete task
export const deleteTask = async (req, res) => {
    try {
        const {userId} = await req.auth();
        const {taskIds} = req.body;
        const tasks = await prisma.task.findMany({
            where: {
                id: {
                    in: taskIds
                }
            }
        })

        if(tasks.length === 0) {
            return res.status(404).json({message: 'Tasks not found'})
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
    
        if(!project) {
            return res.status(404).json({message: 'Project not found'})
        }else if(project.team_lead !== userId) {
            return res.status(403).json({message: 'You are not authorized to delete task for this project'})
        }

        await prisma.task.deleteMany({
            where: {
                id: {
                    in: tasksIds
                }
            }
        })

        return res.json({message:'Tasks deleted successfully'})

    } catch (error) {
        console.error(error)
        return res.status(500).json({message: error.code || error.message})
    }
}