export const protect = async (req, res, next) => {
    try {
        const { userId } = await req.auth();
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.userId = userId;
        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};