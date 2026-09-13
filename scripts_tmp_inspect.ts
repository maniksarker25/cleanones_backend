import mongoose from 'mongoose';
import config from '../src/app/config';
import { User } from '../src/app/modules/user/user.model';
import { Client } from '../src/app/modules/client/client.model';
import { Manager } from '../src/app/modules/manager/manager.model';
import { Location } from '../src/app/modules/location/location.model';
import { Room } from '../src/app/modules/room/room.model';
import { Task } from '../src/app/modules/task/task.model';

const run = async () => {
    await mongoose.connect(config.database_url as string);

    const managerUser = await User.findOne({ email: 'top_manager@yopmail.com' }).lean();
    console.log('managerUser:', JSON.stringify(managerUser, null, 2));

    const client = await Client.findOne({ email: 'demo.cleaning.client3@example.com' }).lean();
    console.log('client:', JSON.stringify(client, null, 2));

    if (client) {
        const locations = await Location.find({ client: client._id }).lean();
        console.log('locations:', JSON.stringify(locations, null, 2));

        for (const loc of locations) {
            const rooms = await Room.find({ location: loc._id }).lean();
            console.log(`rooms for location ${loc._id}:`, JSON.stringify(rooms, null, 2));
            for (const room of rooms) {
                const tasks = await Task.find({ room: room._id }).lean();
                console.log(`tasks for room ${room._id}:`, JSON.stringify(tasks, null, 2));
            }
        }
    }

    await mongoose.disconnect();
};

run().catch((e) => { console.error(e); process.exit(1); });
