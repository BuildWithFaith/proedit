"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useDropzone } from "react-dropzone"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Upload, File } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { usePeer } from "@/contexts/PeerContext"

interface FileMetadata {
  name: string
  type: string
  size: number
  totalChunks: number
}

interface FileChunk {
  index: number
  data: Uint8Array
}

interface TransferRecord {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  timestamp: number
  direction: "sent" | "received"
}

export default function FilesPage() {
  const { connection, isConnected, connectedPeerId, sendData } = usePeer()
  const [transferProgress, setTransferProgress] = useState<number>(0)
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([])
  const fileMetadataRef = useRef<FileMetadata | null>(null)
  const receivedChunksRef = useRef<Map<number, Uint8Array>>(new Map())
  const receivedSizeRef = useRef<number>(0)

  useEffect(() => {
    console.log("Files page - Connection state:", { isConnected, connectedPeerId })
  }, [isConnected, connectedPeerId])

  useEffect(() => {
    if (connection) {
      const handleData = (data: any) => {
        if (data && typeof data === "object" && "metadata" in data) {
          fileMetadataRef.current = data.metadata as FileMetadata
          receivedChunksRef.current.clear()
          receivedSizeRef.current = 0
          setTransferProgress(0)
          toast({
            title: "Receiving File",
            description: `Starting to receive: ${fileMetadataRef.current.name}`,
          })
        } else if (data && typeof data === "object" && "index" in data && "data" in data) {
          const chunk = data as FileChunk
          receivedChunksRef.current.set(chunk.index, new Uint8Array(chunk.data))
          receivedSizeRef.current += chunk.data.length

          if (fileMetadataRef.current) {
            const progress = (receivedChunksRef.current.size / fileMetadataRef.current.totalChunks) * 100
            setTransferProgress(progress)

            if (receivedChunksRef.current.size === fileMetadataRef.current.totalChunks) {
              assembleAndDownloadFile()
            }
          }
        }
      }

      connection.on("data", handleData)

      return () => {
        connection.off("data", handleData)
      }
    }
  }, [connection])

  const assembleAndDownloadFile = useCallback(() => {
    if (fileMetadataRef.current) {
      const sortedChunks = Array.from(receivedChunksRef.current.entries())
        .sort(([a], [b]) => a - b)
        .map(([, chunk]) => chunk)

      const fileData = new Uint8Array(fileMetadataRef.current.size)
      let offset = 0
      for (const chunk of sortedChunks) {
        fileData.set(chunk, offset)
        offset += chunk.length
      }

      const blob = new Blob([fileData], { type: fileMetadataRef.current.type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileMetadataRef.current.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      saveTransferRecord({
        id: `${Date.now()}-${fileMetadataRef.current.name}`,
        fileName: fileMetadataRef.current.name,
        fileType: fileMetadataRef.current.type,
        fileSize: fileMetadataRef.current.size,
        timestamp: Date.now(),
        direction: "received",
      })
      
      toast({
        title: "File Received",
        description: `File downloaded: ${fileMetadataRef.current.name}`,
      })

      fileMetadataRef.current = null
      receivedChunksRef.current.clear()
      receivedSizeRef.current = 0
      setTransferProgress(0)

    }
  }, [])

  const saveTransferRecord = useCallback((record: TransferRecord) => {
    setTransferHistory((prev) => {
      const newHistory = [...prev, record]
      localStorage.setItem("transferHistory", JSON.stringify(newHistory))
      return newHistory
    })
  }, [])

  const sendFile = useCallback(
    (file: File) => {
      if (connection) {
        const chunkSize = 16384 // 16KB chunks
        const totalChunks = Math.ceil(file.size / chunkSize)

        sendData({
          metadata: {
            name: file.name,
            type: file.type,
            size: file.size,
            totalChunks: totalChunks,
          },
        })

        const sendChunk = (chunkIndex: number) => {
          const start = chunkIndex * chunkSize
          const end = Math.min(start + chunkSize, file.size)
          const chunk = file.slice(start, end)

          const reader = new FileReader()
          reader.onload = (e) => {
            if (e.target?.result instanceof ArrayBuffer) {
              sendData({
                index: chunkIndex,
                data: new Uint8Array(e.target.result),
              })

              const progress = ((chunkIndex + 1) / totalChunks) * 100
              setTransferProgress(progress)

              if (chunkIndex + 1 < totalChunks) {
                sendChunk(chunkIndex + 1)
              } else {
                saveTransferRecord({
                  id: `${Date.now()}-${file.name}`,
                  fileName: file.name,
                  fileType: file.type,
                  fileSize: file.size,
                  timestamp: Date.now(),
                  direction: "sent",
                })
                setTransferProgress(0)
                toast({
                  title: "File Sent",
                  description: `File sent successfully: ${file.name}`,
                })
              }
            }
          }
          reader.readAsArrayBuffer(chunk)
        }

        sendChunk(0)
      }
    },
    [connection, sendData, saveTransferRecord],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (isConnected) {
        acceptedFiles.forEach((file) => {
          sendFile(file)
        })
      } else {
        toast({
          title: "Error",
          description: "Please connect to a peer before sending files",
          variant: "destructive",
        })
      }
    },
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem("transferHistory")
    if (savedHistory) {
      setTransferHistory(JSON.parse(savedHistory))
    }
  }, [])

  if (!isConnected) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-center">Please connect to a peer on the home page before sharing files.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>File Transfer with {connectedPeerId}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary" : "border-muted-foreground"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2">Drag 'n' drop some files here, or click to select files</p>
          </div>
          {transferProgress > 0 && (
            <div className="mt-4">
              <Progress value={transferProgress} className="w-full" />
              <p className="text-sm text-center mt-2">{transferProgress.toFixed(2)}% Complete</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {transferHistory.map((record) => (
              <div key={record.id} className="mb-2 p-2 border rounded">
                <p>
                  <File className="inline-block mr-2 h-4 w-4" />
                  {record.fileName} ({(record.fileSize / 1024).toFixed(2)} KB)
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(record.timestamp).toLocaleString()} - {record.direction}
                </p>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

