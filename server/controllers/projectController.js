import prisma from "../configs/prisma.js";

export const createProject = async (req, res) => {
   try {
      const {userId} = await req.auth();
      const {workspaceId, description,name, status, start_date, end_date,team_members,
        team_lead,progress,priority} = req.body;

        // check if  user has admin role for workspace
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: {members: {include:{user:true}}}
        })

        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        if (!workspace.members.some((member)=> member.userId === userId && member.role === "ADMIN")) {
           return res.status(403).json({ message: 'You do not have permission to create a project in this workspace' });
        }
        // get team lead using email
        const teamLead = await prisma.user.findUnique({
            where: { email: team_lead },
            select: { id: true }
        })

        if (!teamLead) {
            return res.status(404).json({ message: 'Team lead not found' });
        }

        const project = await prisma.project.create({
            data: {
                workspaceId,
                name,
                description,
                status,
                priority,
                progress,
                team_lead: teamLead?.id,
                start_date: start_date? new Date(start_date) : null,
                end_date: end_date? new Date(end_date) : null,
            }
        })

       // add team members to project if they are in workspace
        if(team_members?.length > 0){
          const membersToAdd = []
          workspace.members.forEach(member => {
            if(team_members.includes(member.user.email)){
              membersToAdd.push(member.user.id)
            }
          })
        
          await prisma.projectMember.createMany({
            data: membersToAdd.map(memberId => ({
              projectId: project.id,
              userId: memberId
            }))
          })
    }
    
    const projectWithMembers = await prisma.project.findUnique({
          where: { id: project.id },
          include: {members:{user:true}},
          tasks: {include:{assignee:true, Comments:{include:{user:true}}}},
          owner: true
    
        })

        res.json({project: projectWithMembers, message:"project created successfully"});


   } catch (error) {
     console.error(error);
     res.status(500).json({ message: error.message || error.message });
   }
}

// update project
export const updateProject = async (req, res) => {
   try {
    const { userId } = await req.auth();
    const { id, workspaceId, name, description, status, start_date, end_date, 
            priority,progress} = req.body;
     
    // check if user has admin role for workspace
            const workspace = await prisma.workspace.findUnique({
                where: { id: workspaceId },
                include: { members: {include:{user:true}}}}
            );

            if(!workspace){
                return res.status(404).json({ message: 'workspace not found' });
            }
            if(!workspace.members.some(member => member.userId === userId && 
                member.role === "ADMIN")){
               const project = await prisma.project.findUnique({
                where: { id }
               })
               if(!project){
                return res.status(404).json({ message: 'project not found' });
               }
               else if(project.team_lead !== userId){
                return res.status(403).json({ message: 'you are not authorized to update this project' });
               }
            }
            const project = await prisma.project.update({
                where: { id },
                data: {
                    workspaceId,
                    name,
                    description,
                    status,
                    priority,
                    progress,
                    start_date: start_date ? new Date(start_date) : null,
                    end_date: end_date ? new Date(end_date) : null,
                }
            })
            res.json({project, message: "project updated successfully"});
     

   } catch (error) {
     console.error(error);
     res.status(500).json({ message: error.message || error.message });
   }
}

// add member to project
export const addMember = async (req, res) => {
   try {
       const { userId } = await req.auth();
       const { projectId } = req.params;
       const { email } = req.body;

        // check if user is project lead
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { members:{include:{user:true}}}

         })
         
        if(!project){
            return res.status(404).json({ message: 'project not found' });
        }

        if(project.team_lead !== userId){
            return res.status(404).json({ message: 'only project lead can add member' });
        }

        // check if user is already a member
        const existingMember = project.members.find(member => member.email === email);
        if(existingMember){
            return res.status(400).json({ message: 'user is already a member' });
        }
        const user = await prisma.user.findUnique({
            where: { email }
        });
        if(!user){
            return res.status(404).json({ message: 'user not found' });
        }

        const member = await prisma.projectMember.create({
            data: {
                userId: user.id,
                projectId  
            }
        });
        
        res.json({member, message:"member added successfully"}); 
   } catch (error) {
     console.error(error);
     res.status(500).json({ message: error.message || error.message });
   }
};