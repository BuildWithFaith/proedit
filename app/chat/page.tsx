"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePeer } from "@/contexts/PeerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FileAnnotation } from "@/components/file-annotation";

interface Message {
  sender: string;
  content: string;
  timestamp: Date;
}

interface FileMetadata {
  name: string;
  type: string;
  size: number;
}

export default function ChatPage() {
  const { isConnected, connectedPeerId, sendData, connection, connectToPeer, peerId } = usePeer();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [annotations, setAnnotations] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (connection) {
      const handleData = (data: any) => {
        if (data?.type === "chat") {
          setMessages((prevMessages) => [
            ...prevMessages,
            { sender: connectedPeerId || "Peer", content: data.message, timestamp: new Date() },
          ]);
        } else if (data?.type === "file") {
          toast({ title: "File Received", description: `Received file: ${data.metadata.name}` });
        }
      };
      connection.on("data", handleData);
      return () => {
        connection.off("data", handleData);
      };
    }
  }, [connection, connectedPeerId, toast]);

  useEffect(() => {
    if (!isConnected && connectedPeerId) {
      connectToPeer(connectedPeerId);
    }
  }, [isConnected, connectedPeerId, connectToPeer]);

  const sendMessage = useCallback(() => {
    if (connection && inputMessage.trim()) {
      sendData({ type: "chat", message: inputMessage });
      setMessages((prev) => [...prev, { sender: "You", content: inputMessage, timestamp: new Date() }]);
      setInputMessage("");
    } else {
      toast({ title: "Connection Error", description: "You are not connected to a peer.", variant: "destructive" });
    }
  }, [connection, inputMessage, sendData, toast]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const sendFile = () => {
    if (selectedFile) {
      const metadata: FileMetadata = {
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size,
      };
      sendData({ type: "file", metadata });
      toast({ title: "File Sent", description: `Sent file: ${selectedFile.name}` });
      setSelectedFile(null);
    }
  };

  const handleSaveAnnotation = (fileName: string, annotation: string) => {
    setAnnotations((prev) => ({ ...prev, [fileName]: annotation }));
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Chat with {connectedPeerId || "No Peer Connected"}</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] mb-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-2 p-2 rounded-lg ${
                  msg.sender === "You" ? "bg-blue-500 text-white ml-auto" : "bg-gray-200"
                } max-w-[80%]`}
              >
                <p className="font-semibold">{msg.sender}</p>
                <p>{msg.content}</p>
                <p className="text-xs text-gray-500">{msg.timestamp.toLocaleTimeString()}</p>
              </div>
            ))}
          </ScrollArea>
          <div className="flex space-x-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            />
            <Button onClick={sendMessage}>
              <Send className="mr-2 h-4 w-4" /> Send
            </Button>
          </div>
          <div className="mt-4">
            <input type="file" onChange={handleFileUpload} />
            <Button onClick={sendFile} className="ml-2">
              <Upload className="mr-2 h-4 w-4" /> Send File
            </Button>
          </div>
          {selectedFile && (
            <FileAnnotation
              file={selectedFile}
              annotation={annotations[selectedFile.name] || ""}
              onSave={handleSaveAnnotation}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
