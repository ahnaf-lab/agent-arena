// Pure text renderers for the broadcast TUI. Every function here takes
// plain data and returns a string -- no terminal or process access -- so
// the layout logic is testable without a real screen. `src/tui/screen.js`
// is the only place that touches a terminal.

function padEnd(value, width) {
  const text = String(value);
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function padStart(value, width) {
  const text = String(value);
  return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

function ruleLine(widths) {
  return widths.map((w) => '-'.repeat(w)).join('  ');
}

function row(cells, widths, aligns) {
  return cells
    .map((cell, i) => (aligns[i] === 'right' ? padStart(cell, widths[i]) : padEnd(cell, widths[i])))
    .join('  ');
}

export function renderTitle(text) {
  const bar = '='.repeat(text.length);
  return `${text}\n${bar}`;
}

// standings: array of { name, wins, losses, draws, points }, already ranked.
export function renderStandingsTable(standings) {
  const header = ['#', 'Agent', 'W', 'L', 'D', 'Points'];
  const widths = [2, 18, 3, 3, 3, 6];
  const aligns = ['right', 'left', 'right', 'right', 'right', 'right'];

  const lines = [row(header, widths, aligns), ruleLine(widths)];
  standings.forEach((standing, index) => {
    lines.push(
      row(
        [
          String(index + 1),
          standing.name,
          String(standing.wins),
          String(standing.losses),
          String(standing.draws),
          String(standing.points),
        ],
        widths,
        aligns
      )
    );
  });
  return lines.join('\n');
}

function roundCellsForPrisonersDilemma(round, roundNumber) {
  return [String(roundNumber), round.moves[0], round.moves[1], `${round.scores[0]}-${round.scores[1]}`];
}

function roundCellsForResourceSplit(round, roundNumber) {
  const outcome = round.overClaimed ? 'both claims rejected' : `${round.payouts[0]}-${round.payouts[1]}`;
  return [String(roundNumber), String(round.claims[0]), String(round.claims[1]), outcome];
}

// match: one entry from runRoundRobin's `matches` array (has `.players` and
// `.result.history`). Detects which game produced the history by shape,
// since both engines return a `history` array but with different fields.
export function renderMoveHistory(match, options = {}) {
  const { limit } = options;
  const history = match.result.history;
  const [playerA, playerB] = match.players;
  const isPrisonersDilemma = history.length > 0 && 'moves' in history[0];

  const header = ['Rd', playerA, playerB, 'Result'];
  const widths = [3, 14, 14, 16];
  const aligns = ['right', 'left', 'left', 'left'];

  const rounds = typeof limit === 'number' ? history.slice(-limit) : history;
  const startRoundNumber = history.length - rounds.length + 1;

  const lines = [row(header, widths, aligns), ruleLine(widths)];
  rounds.forEach((round, i) => {
    const roundNumber = startRoundNumber + i;
    const cells = isPrisonersDilemma
      ? roundCellsForPrisonersDilemma(round, roundNumber)
      : roundCellsForResourceSplit(round, roundNumber);
    lines.push(row(cells, widths, aligns));
  });
  return lines.join('\n');
}

// pairings: array of [indexA, indexB] into `agentNames`, covering the full
// bracket. completedByPair: a Map keyed by `${indexA}-${indexB}` with the
// finished match's totalScores, used to mark each slot as done or pending.
export function renderBracket(agentNames, pairings, completedByPair) {
  const lines = pairings.map(([indexA, indexB]) => {
    const key = `${indexA}-${indexB}`;
    const nameA = agentNames[indexA];
    const nameB = agentNames[indexB];
    const totals = completedByPair.get(key);
    if (!totals) {
      return `  ${nameA} vs ${nameB}  ... pending`;
    }
    const marker = totals[0] === totals[1] ? '=' : totals[0] > totals[1] ? '>' : '<';
    return `  ${nameA} ${totals[0]} ${marker} ${totals[1]} ${nameB}  (done)`;
  });
  return lines.join('\n');
}

export function pairKey(indexA, indexB) {
  return `${indexA}-${indexB}`;
}

// Combines every view into one full frame string for a single redraw.
// `latestMatch` (optional) is the most recently completed match, shown
// with its full round-by-round history.
export function renderFrame(state) {
  const { title, standings, agentNames, pairings, completedByPair, latestMatch, matchNumber, totalMatches } = state;

  const sections = [renderTitle(title)];

  if (typeof matchNumber === 'number' && typeof totalMatches === 'number') {
    sections.push(`Match ${matchNumber} / ${totalMatches}`);
  }

  sections.push('Standings:', renderStandingsTable(standings));
  sections.push('Bracket:', renderBracket(agentNames, pairings, completedByPair));

  if (latestMatch) {
    sections.push(`Latest match: ${latestMatch.players[0]} vs ${latestMatch.players[1]}`, renderMoveHistory(latestMatch));
  }

  return sections.join('\n\n');
}
