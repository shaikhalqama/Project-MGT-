import prisma from "../configs/prisma.js";
import sendEmail from "../configs/nodeMailer.js";

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
                        members: { include: { user: true } },
                        owner: true
                    }
                },
                owner: true
            }
        });

        // Ensure team lead is always included in project members
        const workspacesWithTeamLeads = workspaces.map(workspace => ({
            ...workspace,
            projects: workspace.projects.map(project => {
                const memberIds = project.members.map(m => m.userId);
                if (!memberIds.includes(project.team_lead)) {
                    return {
                        ...project,
                        members: [
                            ...project.members,
                            {
                                id: `temp-${project.team_lead}`,
                                userId: project.team_lead,
                                projectId: project.id,
                                user: project.owner
                            }
                        ]
                    };
                }
                return project;
            })
        }));

        res.json({ workspaces: workspacesWithTeamLeads });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message || error.message });
    }
}

// Add Member to workspace
export const sendInvitationEmail = async (req, res) => {
    try {
        const { email, workspaceName, workspaceId, role, inviteUrl } = req.body;

        if (!email || !workspaceName) {
            return res.status(400).json({ error: 'Email and workspace name are required' });
        }

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
                <h2 style="margin-bottom: 12px;">You're invited to join ${workspaceName}</h2>
                <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                    You’ve been invited to collaborate in <strong>${workspaceName}</strong> on Projectify.
                </p>
                <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                    Role: <strong>${role || 'Member'}</strong>
                </p>
                <p style="margin-top: 20px;">
                    <a href="${inviteUrl || 'https://projectify.app'}" style="background: #2563eb; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; display: inline-block;">
                        Open Invitation
                    </a>
                </p>
                <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
                    If you weren’t expecting this invitation, you can safely ignore this email.
                </p>
            </div>
        `;

        await sendEmail({
            to: email,
            subject: `You're invited to join ${workspaceName}`,
            body: html,
        });

        res.json({ message: 'Invitation email sent successfully' });
    } catch (error) {
        console.error('Error sending invitation email:', error);
        res.status(500).json({ message: error.message || 'Failed to send invitation email' });
    }
};

export const addMember = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { email, role, workspaceId, message } = req.body;

        // check if user exists
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!workspaceId || !role) {
            return res.status(400).json({ error: 'Workspace ID and role are required' });
        }

        if (!["ADMIN", "MEMBER"].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // fetch workpace and check if user is owner
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: { members: true }
        });
        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        //check  creater has admin role
        if (!workspace.members.find((member) => member.userId === userId && member.role === "ADMIN")) {
            return res.status(401).json({ message: 'You are not authorized to add members to this workspace' });
        }

        // check if user is already a member
        const existingMember = await prisma.workspaceMember.find((member) => member.userId === userId);
        if (existingMember) {
            return res.status(400).json({ message: 'User is already a member' });
        }

        const member = await prisma.workspaceMember.create({
            data: {
                userId: user.id,
                workspaceId: workspaceId,
                role,
                message
            }
        })

        res.json({ message: 'Member added successfully', member });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || error.message });
    }
}