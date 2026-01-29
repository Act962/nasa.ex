// import { createInstance } from "@/http/uazapi/admin/create-instance";
// import { listInstances } from "@/http/uazapi/admin/list-instances";
// import { configureWebhook } from "@/http/uazapi/configure-webhook";
// import { connectInstance } from "@/http/uazapi/connect-instance";
// import { deleteInstance } from "@/http/uazapi/delete-instance";
// import { disconnectInstance } from "@/http/uazapi/disconnect-instance";
// import { getInstanceStatus } from "@/http/uazapi/get-instance-status";

// import { sendText } from "@/http/uazapi/send-text";

// export async function POST(request: Request) {
//     const create = await createInstance(
//       {
//         name: "TESTE",
//       },
//       "ZaW1qwTEkuq7Ub1cBUuyMiK5bNSu3nnMQ9lh7klElc2clSRV8t",
//     );

//     const connect = await connectInstance("032f0b62-d854-451c-9b22-cb41e7f68bb2");
//     const status = await getInstanceStatus(
//       "032f0b62-d854-451c-9b22-cb41e7f68bb2",
//     );

//     const configWebhok = await configureWebhook(
//       "032f0b62-d854-451c-9b22-cb41e7f68bb2",
//       {
//         action: "delete",
//         id: "rdda7c05ef1e31a",
//       },
//     );

//     const disconnect = await disconnectInstance(
//       "032f0b62-d854-451c-9b22-cb41e7f68bb2",
//     );

//   const del = await deleteInstance("032f0b62-d854-451c-9b22-cb41e7f68bb2");

//   console.log(del);

//   return Response.json(del);
// }

// 032f0b62-d854-451c-9b22-cb41e7f68bb2

// export async function POST(request: Request) {
//   const send = await sendText("6e891f34-1ff2-41db-b413-152c8ab14d3b", {
//     number: "558688923098",
//     text: "Olá! Como posso ajudar?",
//   });

//   return Response.json(send);
// }
