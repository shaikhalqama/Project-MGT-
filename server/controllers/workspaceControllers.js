import prisma from "../configs/prisma.js";

// Create workspace directly (fallback if webhook fails)
export const createWorkspace = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { id, name, slug, image_url } = req.body;

        const workspace = await prisma.workspace.create({
            data: {
                id,
                name,
                slug,
                ownerId: userId,
                image_url: image_url || "",
            }
        });

        // Add creator as ADMIN member
        await prisma.workspaceMember.create({
            data: {
                userId,
                workspaceId: id,
                role: "ADMIN"
            }
        });

        res.json({ workspace });
    } catch (error) {
        console.error("Error creating workspace:", error);
        res.status(500).json({ message: error.message });
    }
}

// get all workspace for user
export const getUserWorkspaces = async (req, res) => {
    try {
        const { userId } = await req.auth();

        const workspaces = await prisma.workspace.findMany({
            where: {
                members: { some: { userId: userId } }
            },
            include: {
                members: { include: { user: true } },
                projects: {
                    include: {
                        tasks: {
                            include: {
                                assignee: true,
                                comments: {
                                    include: { user: true }
                                }
                            }
                        },
                        members: { include: { user: true } }
                    }
                },
                owner: true
            }
        });
        res.json(workspaces);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message || error.message });
    }
}

// Add Member to workspace
export const addMember = async (req, res) => {
    try{
        const { userId } = await req.auth();
        const {email, role, workspaceId, message} = req.body;

        // check if user exists
        const user = await prisma.user.findUnique({where: {email}});
        if(!user){
            return res.status(404).json({error: 'User not found'});
        }
        
        if(!workspaceId || !role){
            return res.status(400).json({error: 'Workspace ID and role are required'});
        }

        if(!["ADMIN", "MEMBER"].includes(role)){
            return res.status(400).json({error: 'Invalid role'});
        }

        // fetch workpace and check if user is owner
        const workspace = await prisma.workspace.findUnique({
            where: {id: workspaceId},
            include: {members: true}
        });
        if(!workspace){
            return res.status(404).json({error: 'Workspace not found'});
        }

        //check  creater has admin role
        if(!workspace.members.find((member) => member.userId === userId && member.role === "ADMIN")) {
            return res.status(401).json({message: 'You are not authorized to add members to this workspace'});
        }

        // check if user is already a member
        const existingMember = await prisma.workspaceMember.find((member)=>member.userId === userId);
        if(existingMember){
            return res.status(400).json({message: 'User is already a member'});
        }

        const member = await prisma.workspaceMember.create({
            data: {
                userId: user.id,
                workspaceId: workspaceId,
                role,
                message
            }
        })

        res.json({message: 'Member added successfully', member});

    }catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || error.message });
    }
}