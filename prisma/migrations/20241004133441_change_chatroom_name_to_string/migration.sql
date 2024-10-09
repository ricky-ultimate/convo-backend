/*
  Warnings:

  - You are about to drop the column `chatRoomId` on the `Message` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `ChatRoom` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `chatRoomName` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_chatRoomId_fkey";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "chatRoomId",
ADD COLUMN     "chatRoomName" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_name_key" ON "ChatRoom"("name");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatRoomName_fkey" FOREIGN KEY ("chatRoomName") REFERENCES "ChatRoom"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
