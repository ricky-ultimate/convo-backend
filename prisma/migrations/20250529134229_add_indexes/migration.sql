-- CreateIndex
CREATE INDEX "ChatRoom_name_idx" ON "ChatRoom"("name");

-- CreateIndex
CREATE INDEX "ChatRoomMembership_userId_idx" ON "ChatRoomMembership"("userId");

-- CreateIndex
CREATE INDEX "ChatRoomMembership_chatRoomId_idx" ON "ChatRoomMembership"("chatRoomId");

-- CreateIndex
CREATE INDEX "Message_chatRoomId_createdAt_idx" ON "Message"("chatRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_userId_idx" ON "Message"("userId");

-- CreateIndex
CREATE INDEX "Message_chatRoomId_idx" ON "Message"("chatRoomId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");
