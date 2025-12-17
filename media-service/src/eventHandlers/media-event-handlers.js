import Media from "../models/media.js";
import { deleteMediaFromCloudinary } from "../utils/cloudinary.js";


export const handlePostDeleted = async(event)=>{
    console.log("event : ", event);
    const {postId , mediaIds} = event;
    try{
        const mediaToDelete = await Media.find({ _id: { $in: mediaIds } });
        for (const media of mediaToDelete) {
            await deleteMediaFromCloudinary(media.publicId);
            await Media.deleteMany({ _id: { $in: mediaIds } });
            logger.info("Media deleted successfully");
        }
        logger.info("Post deleted successfully");
    }catch(error){
        logger.error("Error deleting post", error);
    }

}

