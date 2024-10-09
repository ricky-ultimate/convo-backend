/*
  Warnings:

  - You are about to drop the column `chatRoomName` on the `Message` table. All the data in the column will be lost.
  - Made the column `name` on table `ChatRoom` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `chatRoomId` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_chatRoomName_fkey";

-- AlterTable
ALTER TABLE "ChatRoom" ALTER COLUMN "name" SET NOT NULL;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "chatRoomName",
ADD COLUMN     "chatRoomId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "ChatRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
