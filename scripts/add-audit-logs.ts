import fs from "node:fs";
import path from "node:path";

import {
  Node,
  Project,
  QuoteKind,
  SourceFile,
  SyntaxKind,
  VariableStatement,
} from "ts-morph";

type SupportedOperation =
  | "create"
  | "update"
  | "delete";

type ModelConfiguration = {
  entity: string;
  label: string;
};

type MutationInformation = {
  prismaClientName: string;
  model: string;
  operation: SupportedOperation;
};

type PlannedInsertion = {
  statement: VariableStatement;
  variableName: string;
  model: string;
  operation: SupportedOperation;
  entity: string;
  code: string;
};

type ProcessingResult = {
  changed: boolean;
  additions: number;
  skipped: string[];
};

const ROOT_DIRECTORY = process.cwd();

const API_DIRECTORY = path.join(
  ROOT_DIRECTORY,
  "app",
  "api",
);

const WRITE_MODE =
  process.argv.includes("--write");

const MODEL_CONFIGURATION: Record<
  string,
  ModelConfiguration
> = {
  user: {
    entity: "USER",
    label: "Usuário",
  },

  client: {
    entity: "CLIENT",
    label: "Cliente",
  },

  project: {
    entity: "PROJECT",
    label: "Projeto",
  },

  equipment: {
    entity: "EQUIPMENT",
    label: "Equipamento",
  },

  purchase: {
    entity: "PURCHASE",
    label: "Compra",
  },

  movement: {
    entity: "MOVEMENT",
    label: "Movimentação",
  },

  equipmentMovement: {
    entity: "MOVEMENT",
    label: "Movimentação",
  },
};

const ACTION_BY_OPERATION: Record<
  SupportedOperation,
  string
> = {
  create: "CREATE",
  update: "UPDATE",
  delete: "DELETE",
};

const DESCRIPTION_BY_OPERATION: Record<
  SupportedOperation,
  string
> = {
  create: "cadastrado",
  update: "atualizado",
  delete: "removido",
};

function isSupportedOperation(
  value: string,
): value is SupportedOperation {
  return (
    value === "create" ||
    value === "update" ||
    value === "delete"
  );
}

function getRouteFiles(
  directory: string,
): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(
    directory,
    {
      withFileTypes: true,
    },
  );

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name,
    );

    if (entry.isDirectory()) {
      files.push(
        ...getRouteFiles(fullPath),
      );

      continue;
    }

    if (
      entry.isFile() &&
      entry.name === "route.ts"
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function unwrapExpression(
  expression: Node,
): Node {
  let current = expression;

  while (true) {
    if (
      Node.isAwaitExpression(current)
    ) {
      current =
        current.getExpression();

      continue;
    }

    if (
      Node.isParenthesizedExpression(
        current,
      )
    ) {
      current =
        current.getExpression();

      continue;
    }

    if (
      Node.isAsExpression(current)
    ) {
      current =
        current.getExpression();

      continue;
    }

    if (
      Node.isTypeAssertion(current)
    ) {
      current =
        current.getExpression();

      continue;
    }

    return current;
  }
}

function getMutationInformation(
  statement: VariableStatement,
): MutationInformation | null {
  const declarations =
    statement
      .getDeclarationList()
      .getDeclarations();

  if (declarations.length !== 1) {
    return null;
  }

  const initializer =
    declarations[0].getInitializer();

  if (!initializer) {
    return null;
  }

  const unwrapped =
    unwrapExpression(initializer);

  if (
    !Node.isCallExpression(unwrapped)
  ) {
    return null;
  }

  const operationAccess =
    unwrapped.getExpression();

  if (
    !Node.isPropertyAccessExpression(
      operationAccess,
    )
  ) {
    return null;
  }

  const operation =
    operationAccess.getName();

  if (
    !isSupportedOperation(operation)
  ) {
    return null;
  }

  const modelAccess =
    operationAccess.getExpression();

  if (
    !Node.isPropertyAccessExpression(
      modelAccess,
    )
  ) {
    return null;
  }

  const clientExpression =
    modelAccess.getExpression();

  if (
    !Node.isIdentifier(
      clientExpression,
    )
  ) {
    return null;
  }

  const prismaClientName =
    clientExpression.getText();

  if (
    prismaClientName !== "prisma"
  ) {
    return {
      prismaClientName,
      model: modelAccess.getName(),
      operation,
    };
  }

  return {
    prismaClientName,
    model: modelAccess.getName(),
    operation,
  };
}

function getDeclaredVariableName(
  statement: VariableStatement,
): string | null {
  const declarations =
    statement
      .getDeclarationList()
      .getDeclarations();

  if (declarations.length !== 1) {
    return null;
  }

  const nameNode =
    declarations[0].getNameNode();

  if (!Node.isIdentifier(nameNode)) {
    return null;
  }

  return nameNode.getText();
}

function hasExistingAudit(
  statement: VariableStatement,
  variableName: string,
): boolean {
  const block = statement.getParent();

  if (!Node.isBlock(block)) {
    return false;
  }

  const statements =
    block.getStatements();

  const currentIndex =
    statements.findIndex(
      (item) => item === statement,
    );

  if (currentIndex < 0) {
    return false;
  }

  const nearbyStatements =
    statements.slice(
      currentIndex + 1,
      currentIndex + 6,
    );

  return nearbyStatements.some(
    (item) => {
      const text = item.getText();

      return (
        text.includes("logAudit(") &&
        (
          text.includes(
            `entityId: ${variableName}.id`,
          ) ||
          text.includes(
            `getAuditEntityId(${variableName})`,
          )
        )
      );
    },
  );
}

function findUserIdExpression(
  sourceFile: SourceFile,
): string | null {
  const sessionUser =
    sourceFile.getVariableDeclaration(
      "sessionUser",
    );

  if (sessionUser) {
    return (
      "sessionUser.id ?? null"
    );
  }

  const currentUser =
    sourceFile.getVariableDeclaration(
      "currentUser",
    );

  if (currentUser) {
    return (
      "currentUser.id ?? null"
    );
  }

  const user =
    sourceFile.getVariableDeclaration(
      "user",
    );

  if (
    user &&
    sourceFile
      .getFullText()
      .includes("user.id")
  ) {
    return "user.id ?? null";
  }

  return null;
}

function buildAuditCode({
  variableName,
  operation,
  entity,
  label,
  userIdExpression,
}: {
  variableName: string;
  operation: SupportedOperation;
  entity: string;
  label: string;
  userIdExpression: string | null;
}): string {
  const action =
    ACTION_BY_OPERATION[operation];

  const descriptionAction =
    DESCRIPTION_BY_OPERATION[
      operation
    ];

  const dataField =
    operation === "delete"
      ? "oldData"
      : "newData";

  const userIdLine =
    userIdExpression
      ? `\n  userId: ${userIdExpression},`
      : "";

  return `
await logAudit({
  action: AuditAction.${action},
  entity: AuditEntity.${entity},
  entityId: getAuditEntityId(${variableName}),${userIdLine}
  description: \`${label} "\${getAuditLabel(${variableName})}" ${descriptionAction}.\`,
  ${dataField}: ${variableName},
});`;
}

function ensureNamedImport(
  sourceFile: SourceFile,
  moduleSpecifier: string,
  importNames: string[],
): void {
  const declaration =
    sourceFile.getImportDeclaration(
      moduleSpecifier,
    );

  if (!declaration) {
    sourceFile.addImportDeclaration({
      moduleSpecifier,
      namedImports: importNames,
    });

    return;
  }

  const existingImports = new Set(
    declaration
      .getNamedImports()
      .map((namedImport) =>
        namedImport.getName(),
      ),
  );

  for (
    const importName of importNames
  ) {
    if (
      !existingImports.has(
        importName,
      )
    ) {
      declaration.addNamedImport(
        importName,
      );
    }
  }
}

function ensureAuditImports(
  sourceFile: SourceFile,
): void {
  ensureNamedImport(
    sourceFile,
    "@/lib/audit",
    [
      "getAuditEntityId",
      "getAuditLabel",
      "logAudit",
    ],
  );

  ensureNamedImport(
    sourceFile,
    "@/generated/prisma/enums",
    [
      "AuditAction",
      "AuditEntity",
    ],
  );
}

function processRouteFile(
  project: Project,
  filePath: string,
): ProcessingResult {
  const sourceFile =
    project.addSourceFileAtPath(
      filePath,
    );

  const skipped: string[] = [];
  const insertions: PlannedInsertion[] =
    [];

  const userIdExpression =
    findUserIdExpression(sourceFile);

  const variableStatements =
    sourceFile.getDescendantsOfKind(
      SyntaxKind.VariableStatement,
    );

  for (
    const statement of variableStatements
  ) {
    const mutation =
      getMutationInformation(
        statement,
      );

    if (!mutation) {
      continue;
    }

    if (
      mutation.model === "auditLog"
    ) {
      continue;
    }

    if (
      mutation.prismaClientName !==
      "prisma"
    ) {
      skipped.push(
        `Operação usando "${mutation.prismaClientName}" ignorada: ` +
          `${mutation.model}.${mutation.operation}. ` +
          "Provavelmente está dentro de uma transação.",
      );

      continue;
    }

    const configuration =
      MODEL_CONFIGURATION[
        mutation.model
      ];

    if (!configuration) {
      skipped.push(
        `Modelo não mapeado: ${mutation.model}.${mutation.operation}`,
      );

      continue;
    }

    const variableName =
      getDeclaredVariableName(
        statement,
      );

    if (!variableName) {
      skipped.push(
        `Resultado sem variável simples: ${mutation.model}.${mutation.operation}`,
      );

      continue;
    }

    if (
      hasExistingAudit(
        statement,
        variableName,
      )
    ) {
      continue;
    }

    const code = buildAuditCode({
      variableName,
      operation:
        mutation.operation,
      entity:
        configuration.entity,
      label:
        configuration.label,
      userIdExpression,
    });

    insertions.push({
      statement,
      variableName,
      model: mutation.model,
      operation:
        mutation.operation,
      entity:
        configuration.entity,
      code,
    });
  }

  if (insertions.length === 0) {
    sourceFile.forget();

    return {
      changed: false,
      additions: 0,
      skipped,
    };
  }

  ensureAuditImports(sourceFile);

  const orderedInsertions = [
    ...insertions,
  ].sort(
    (first, second) =>
      second.statement.getStart() -
      first.statement.getStart(),
  );

  let successfulInsertions = 0;

  for (
    const insertion of orderedInsertions
  ) {
    const parent =
      insertion.statement.getParent();

    if (!Node.isBlock(parent)) {
      skipped.push(
        `Operação fora de bloco ignorada: ${insertion.model}.${insertion.operation}`,
      );

      continue;
    }

    const statements =
      parent.getStatements();

    const index =
      statements.findIndex(
        (item) =>
          item ===
          insertion.statement,
      );

    if (index < 0) {
      skipped.push(
        `Posição não localizada: ${insertion.model}.${insertion.operation}`,
      );

      continue;
    }

    parent.insertStatements(
      index + 1,
      insertion.code,
    );

    successfulInsertions += 1;
  }

  sourceFile.organizeImports();

  sourceFile.formatText({
    indentSize: 2,
    convertTabsToSpaces: true,
  });

  if (WRITE_MODE) {
    sourceFile.saveSync();
  }

  sourceFile.forget();

  return {
    changed:
      successfulInsertions > 0,
    additions:
      successfulInsertions,
    skipped,
  };
}

function main(): void {
  console.log("");
  console.log(
    "========== AUDITORIA AUTOMÁTICA ==========",
  );

  console.log(
    WRITE_MODE
      ? "Modo: GRAVAÇÃO"
      : "Modo: ANÁLISE — nenhum arquivo será alterado",
  );

  console.log(
    "==========================================",
  );
  console.log("");

  if (
    !fs.existsSync(API_DIRECTORY)
  ) {
    console.error(
      `Diretório não encontrado: ${API_DIRECTORY}`,
    );

    process.exitCode = 1;
    return;
  }

  const routeFiles =
    getRouteFiles(API_DIRECTORY);

  if (routeFiles.length === 0) {
    console.log(
      "Nenhum arquivo route.ts encontrado.",
    );

    return;
  }

  const project = new Project({
    tsConfigFilePath: path.join(
      ROOT_DIRECTORY,
      "tsconfig.json",
    ),

    skipAddingFilesFromTsConfig: true,

    manipulationSettings: {
      quoteKind: QuoteKind.Double,
      useTrailingCommas: true,
    },
  });

  let changedFiles = 0;
  let totalAdditions = 0;

  const skippedItems: Array<{
    file: string;
    reason: string;
  }> = [];

  for (const filePath of routeFiles) {
    const relativePath =
      path.relative(
        ROOT_DIRECTORY,
        filePath,
      );

    try {
      const result =
        processRouteFile(
          project,
          filePath,
        );

      if (result.changed) {
        changedFiles += 1;
        totalAdditions +=
          result.additions;

        const status =
          WRITE_MODE
            ? "alterado"
            : "seria alterado";

        console.log(
          `✔️ ${relativePath}: ${result.additions} auditoria(s), arquivo ${status}.`,
        );
      }

      for (
        const reason of result.skipped
      ) {
        skippedItems.push({
          file: relativePath,
          reason,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      skippedItems.push({
        file: relativePath,
        reason: message,
      });

      console.error(
        `❌ ${relativePath}: ${message}`,
      );
    }
  }

  console.log("");
  console.log(
    "=============== RESULTADO ===============",
  );

  console.log(
    `Rotas encontradas: ${routeFiles.length}`,
  );

  console.log(
    `Arquivos ${
      WRITE_MODE
        ? "alterados"
        : "que seriam alterados"
    }: ${changedFiles}`,
  );

  console.log(
    `Auditorias ${
      WRITE_MODE
        ? "adicionadas"
        : "planejadas"
    }: ${totalAdditions}`,
  );

  console.log(
    `Itens para revisão manual: ${skippedItems.length}`,
  );

  if (skippedItems.length > 0) {
    console.log("");
    console.log(
      "Casos não modificados automaticamente:",
    );

    for (
      const item of skippedItems
    ) {
      console.log(
        `- ${item.file}`,
      );

      console.log(
        `  ${item.reason}`,
      );
    }
  }

  console.log(
    "=========================================",
  );

  if (!WRITE_MODE) {
    console.log("");
    console.log(
      "Nenhum arquivo foi alterado.",
    );

    console.log(
      "Para aplicar as mudanças, execute:",
    );

    console.log(
      "npm run audit:apply",
    );
  } else {
    console.log("");
    console.log(
      "Alterações aplicadas.",
    );

    console.log(
      "Agora execute npm run build e revise o git diff.",
    );
  }
}

main();