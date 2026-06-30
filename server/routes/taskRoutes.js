import express from 'express'
import { createTask, updateTask, deleteTask } from '../controllers/taskController.js'

const TaskRouter = express.Router()

TaskRouter.post('/', createTask)
TaskRouter.put('/:id', updateTask)
TaskRouter.post('/delete', deleteTask)

export default TaskRouter