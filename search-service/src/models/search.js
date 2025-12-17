import mongoose from "mongoose";

const searchPostSchema = new mongoose.Schema(
  {
    postId: {
      type: String,
      unique: true,
      required: true,
    },
    userId: {
      type: String,
      index: true,
      required: true,
    },
    content: {
      type: String,
      required: true,
      unique: true,
    },
    createdAt:{
        type:Date,
        required:true
    }
  },
  {
    timestamps: true,
  }
);

searchPostSchema.index({ content: "text" });
searchPostSchema.index({ createdAt: -1 });

const SearchPost = mongoose.model("SearchPost", searchPostSchema);
export default SearchPost