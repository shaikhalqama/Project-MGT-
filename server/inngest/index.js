import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";

export const inngest = new Inngest({
    id: "Projectify",
    eventKey: process.env.INNGEST_EVENT_KEY,
});


const syncUserCreation = inngest.createFunction(
    {id: 'sync-user-from-clerk', triggers: { event: 'clerk/user.created' }},
    async ({ event }) => {
        const { data } = event;
        await prisma.user.create({
            data: {
                id: data.id,
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        });
    }
);

const syncUserDeletion = inngest.createFunction(
    {id: 'delete-user-from-clerk', triggers: { event: 'clerk/user.deleted' }},
    async ({ event }) => {
        const { data } = event;
        await prisma.user.delete({
            where: {
                id: data.id,
            }
        });
    }
);


// Inngest function to UPDATE user data to the database
const syncUserUpdation = inngest.createFunction(
    {id: 'update-user-from-clerk', triggers: { event: 'clerk/user.updated' }},
    async ({ event }) => {
        const { data } = event;
        await prisma.user.update({
            where: {
                id: data.id,
            },
            data: {
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.profile_image_url,
            }
        });
    }
);

//inngest to save workspace member data to the database




export const functions = [syncUserCreation,
     syncUserDeletion,
     syncUserUpdation];