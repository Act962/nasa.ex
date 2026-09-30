import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

const COURSE_EDITOR_PATH = "^/nasa-route/criador/curso/[^/]+/editar$";

export const ROUTE_GUIDES: GuideDef[] = [
  {
    key: "route.add-lesson",
    app: "route",
    title: "Adicionar uma aula ao curso",
    summary: "Cadastre a aula no editor do curso.",
    topicPattern: /\b(cri\w*|adicion\w*|coloc\w*|sub\w*|grav\w*|cadastr\w*|novas?)\b.*\b(aulas?|licoes?|videoaulas?)\b/,
    steps: [
      {
        anchor: "routeCourseList",
        route: "/nasa-route/criador",
        skipWhenPath: COURSE_EDITOR_PATH,
        title: "Abra o curso",
        message: "Clique no curso que vai receber a aula.",
        position: "top",
        advanceOn: "next",
        missingMessage: "Você ainda não tem curso. Me peça: \"como crio um curso?\"",
      },
      {
        anchor: "routeNewLessonButton",
        title: "Clique em Nova aula",
        message: "Se o curso tiver módulos, você escolhe em qual a aula entra.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "routeLessonTitle",
        title: "Dê um título à aula",
        message: "O vídeo e o material ficam logo abaixo. Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "routeLessonSubmit",
        title: "Salve a aula",
        message: "Ela entra na lista do curso na hora.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.lessonCreated,
      },
    ],
    finish: {
      title: "Aula adicionada! 🎬",
      message: "Arraste para mudar a ordem das aulas.",
    },
  },
  {
    key: "route.create-course",
    app: "route",
    title: "Criar um curso",
    summary: "Monte o curso e caia no editor de aulas.",
    topicPattern: /\b(cri\w*|mont\w*|fac\w*|faz\w*|lanc\w*|vend\w*|novos?)\b.*\b(cursos?|treinamentos?|mentorias?|infoprodutos?)\b/,
    steps: [
      {
        anchor: "routeNewCourseButton",
        route: "/nasa-route/criador",
        title: "Clique em Novo curso",
        message: "Abre o formulário do curso.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "routeCourseTitle",
        title: "Dê um título ao curso",
        message: "O endereço do curso é preenchido a partir dele. Capa, formato e preço ficam mais abaixo. Depois clique em Continuar.",
        position: "right",
        advanceOn: "input",
      },
      {
        anchor: "routeCourseSubmit",
        title: "Salve o curso",
        message: "Eu te levo para o editor, onde entram as aulas.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.courseCreated,
      },
    ],
    finish: {
      title: "Curso criado! 🎓",
      message: "Agora adicione as aulas. Se quiser, me peça: \"como adiciono uma aula?\"",
    },
  },
];
